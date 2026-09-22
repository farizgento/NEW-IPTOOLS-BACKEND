import { Injectable } from '@nestjs/common';
import oracledb from 'oracledb';
import { OracleService } from '../basisdata/oracle.service';
import { bentukPertanyaan, sesiLengkap, type BarisRekap, type Jawaban, type Pertanyaan } from './kuesioner';

export interface IdentitasResponden {
  namaPerusahaan: string | null;
  namaUnit: string | null;
  jenjangJabatan: string | null;
  bidangPekerjaan: string | null;
  unitOh: string | null;
  jenisInspeksi: string | null;
}

@Injectable()
export class KuesionerRepository {
  constructor(private readonly db: OracleService) {}

  async pertanyaanAktif(): Promise<Pertanyaan[]> {
    const baris = await this.db.kueri<Record<string, unknown>>(
      `SELECT id, kategori, pertanyaan FROM pertanyaan_kuesioner
        WHERE aktif = 1 ORDER BY urutan, id`,
    );
    return baris.map((r) => ({
      id: Number(r.ID),
      kategori: (r.KATEGORI as string) ?? null,
      pertanyaan: r.PERTANYAAN as string,
    }));
  }

  async ambil(id: number) {
    const sesi = await this.db.kueriSatu<Record<string, unknown>>(
      `SELECT k.id, k.peminjaman_id, k.status, k.nama_perusahaan, k.nama_unit,
              k.jenjang_jabatan, k.bidang_pekerjaan, k.unit_oh, k.jenis_inspeksi,
              k.pengisi_id, NVL(p.nama, k.nama_pengisi_historis) AS pengisi,
              TO_CHAR(k.tanggal, 'YYYY-MM-DD HH24:MI') AS tanggal
         FROM kuesioner k
         LEFT JOIN pengguna p ON p.id = k.pengisi_id
        WHERE k.id = :id`,
      { id },
    );
    if (!sesi) return undefined;
    const jawaban = await this.db.kueri(
      `SELECT j.pertanyaan_id, pt.kategori, pt.pertanyaan, j.kepentingan, j.kinerja
         FROM kuesioner_jawaban j
         LEFT JOIN pertanyaan_kuesioner pt ON pt.id = j.pertanyaan_id
        WHERE j.kuesioner_id = :id
        ORDER BY pt.urutan, j.pertanyaan_id`,
      { id },
    );
    return { sesi, jawaban };
  }

  async buat(masukan: IdentitasResponden & {
    peminjamanId: number | null;
    pengisiId: number;
    namaPengisi: string;
  }): Promise<number> {
    return this.db.transaksi(async (koneksi) => {
      const hasil = await koneksi.execute<{ id: number[] }>(
        `INSERT INTO kuesioner (peminjaman_id, tanggal, nama_perusahaan, nama_unit,
                                jenjang_jabatan, bidang_pekerjaan, unit_oh, jenis_inspeksi,
                                status, pengisi_id, nama_pengisi_historis)
         VALUES (:peminjamanId, SYSTIMESTAMP, :namaPerusahaan, :namaUnit,
                 :jenjangJabatan, :bidangPekerjaan, :unitOh, :jenisInspeksi,
                 'DRAFT', :pengisiId, :namaPengisi)
         RETURNING id INTO :id`,
        { ...masukan, id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
      );
      return Number(hasil.outBinds?.id?.[0]);
    });
  }

  /**
   * Menyimpan seluruh jawaban sekaligus, dalam satu transaksi.
   *
   * MERGE memperbarui jawaban yang sudah ada alih-alih menambah baris baru —
   * kebalikan dari procedure lama yang selalu menambah. Status sesi diputuskan
   * dari pertanyaan yang terjawab, bukan dari jumlah baris.
   */
  async simpanJawaban(masukan: {
    kuesionerId: number;
    pertanyaan: Pertanyaan[];
    jawaban: Jawaban[];
    penjawabId: number;
    email: string;
  }): Promise<{ status: string; terjawab: number; jumlahPertanyaan: number }> {
    const bentuk = new Map(masukan.pertanyaan.map((p) => [p.id, bentukPertanyaan(p)]));

    return this.db.transaksi(async (koneksi) => {
      for (const j of masukan.jawaban) {
        const teks = bentuk.get(j.pertanyaanId) === 'TEKS';
        await koneksi.execute(
          `MERGE INTO kuesioner_jawaban t
           USING (SELECT :kuesionerId AS kuesioner_id, :pertanyaanId AS pertanyaan_id FROM dual) s
              ON (t.kuesioner_id = s.kuesioner_id AND t.pertanyaan_id = s.pertanyaan_id)
            WHEN MATCHED THEN UPDATE SET kepentingan = :kepentingan, kinerja = :kinerja,
                                         penjawab_id = :penjawabId, email_historis = :email
            WHEN NOT MATCHED THEN INSERT (kuesioner_id, pertanyaan_id, kepentingan, kinerja,
                                          penjawab_id, email_historis)
                 VALUES (:kuesionerId, :pertanyaanId, :kepentingan, :kinerja, :penjawabId, :email)`,
          {
            kuesionerId: masukan.kuesionerId,
            pertanyaanId: j.pertanyaanId,
            // Kritik dan saran disimpan di kolom kepentingan, seperti sistem lama.
            kepentingan: teks ? (j.teks?.trim() ?? null) : String(j.kepentingan),
            kinerja: teks ? null : String(j.kinerja),
            penjawabId: masukan.penjawabId,
            email: masukan.email,
          },
        );
      }

      const hasil = await koneksi.execute<{ PERTANYAAN_ID: number }>(
        `SELECT pertanyaan_id FROM kuesioner_jawaban WHERE kuesioner_id = :id`,
        { id: masukan.kuesionerId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      const terjawab = (hasil.rows ?? []).map((r) => Number(r.PERTANYAAN_ID));
      const aktif = masukan.pertanyaan.map((p) => p.id);
      const status = sesiLengkap(aktif, terjawab) ? 'SUBMIT' : 'DRAFT';

      await koneksi.execute(`UPDATE kuesioner SET status = :status WHERE id = :id`, {
        status,
        id: masukan.kuesionerId,
      });

      return {
        status,
        terjawab: aktif.filter((id) => terjawab.includes(id)).length,
        jumlahPertanyaan: aktif.length,
      };
    });
  }

  /** Nilai skala dari sesi yang sudah lengkap, untuk rekap Importance-Performance. */
  async barisRekap(): Promise<BarisRekap[]> {
    const baris = await this.db.kueri<Record<string, unknown>>(
      `SELECT j.pertanyaan_id, j.kepentingan, j.kinerja
         FROM kuesioner_jawaban j
         JOIN kuesioner k ON k.id = j.kuesioner_id
        WHERE k.status = 'SUBMIT'
          AND REGEXP_LIKE(j.kepentingan, '^[1-5]$')
          AND REGEXP_LIKE(j.kinerja, '^[1-5]$')`,
    );
    return baris.map((r) => ({
      pertanyaanId: Number(r.PERTANYAAN_ID),
      kepentingan: Number(r.KEPENTINGAN),
      kinerja: Number(r.KINERJA),
    }));
  }

  async masukanTeks() {
    return this.db.kueri(
      `SELECT pt.kategori, j.kepentingan AS isi,
              TO_CHAR(k.tanggal, 'YYYY-MM-DD') AS tanggal
         FROM kuesioner_jawaban j
         JOIN kuesioner k ON k.id = j.kuesioner_id
         JOIN pertanyaan_kuesioner pt ON pt.id = j.pertanyaan_id
        WHERE UPPER(pt.kategori) IN ('KRITIK','SARAN')
          AND j.kepentingan IS NOT NULL
        ORDER BY k.tanggal DESC`,
    );
  }
}
