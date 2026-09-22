import { Injectable } from '@nestjs/common';
import oracledb from 'oracledb';
import { OracleService } from '../basisdata/oracle.service';
import type { JenjangPengingat } from './pengingat';

export type Kanal = 'SUREL' | 'PUSH' | 'WHATSAPP';

export interface CalonPengingatKonfirmasi {
  serahTerimaId: number;
  peminjamanId: number;
  penerimaId: number | null;
  penerimaEmail: string | null;
  namaPenerima: string;
  jumlahBelum: number;
  diserahkanPada: Date;
  sudahDikirim: JenjangPengingat[];
}

export interface CalonPengingatPengembalian {
  peminjamanId: number;
  penerimaId: number | null;
  penerimaEmail: string | null;
  namaPenerima: string;
  jumlahAlat: number;
  tanggalSelesai: Date;
  sudahDikirim: JenjangPengingat[];
}

@Injectable()
export class NotifikasiRepository {
  constructor(private readonly db: OracleService) {}

  /**
   * Serah terima yang sudah diserahkan tetapi masih menyisakan alat yang belum
   * dikonfirmasi. Jenjang yang sudah pernah dikirim ikut dibaca agar tidak
   * berulang.
   */
  async calonKonfirmasi(): Promise<CalonPengingatKonfirmasi[]> {
    const baris = await this.db.kueri<Record<string, unknown>>(`
      SELECT st.id AS serah_terima_id, st.peminjaman_id, st.diserahkan_pada,
             pm.peminjam_id, p.email AS penerima_email,
             NVL(p.nama, pm.nama_peminjam_historis) AS nama_penerima,
             (SELECT COUNT(*) FROM serah_terima_alat x
               WHERE x.serah_terima_id = st.id AND x.dikonfirmasi_pada IS NULL) AS jumlah_belum,
             (SELECT LISTAGG(n.perihal, '|') WITHIN GROUP (ORDER BY n.id)
                FROM notifikasi n
               WHERE n.entitas = 'SERAH_TERIMA' AND n.entitas_id = st.id
                 AND n.status IN ('TERKIRIM','MENUNGGU')) AS sudah
        FROM serah_terima st
        JOIN peminjaman pm   ON pm.id = st.peminjaman_id
        LEFT JOIN pengguna p ON p.id = pm.peminjam_id
       WHERE st.status IN ('SENT','RETURN')
         AND st.diserahkan_pada IS NOT NULL
         AND EXISTS (SELECT 1 FROM serah_terima_alat x
                      WHERE x.serah_terima_id = st.id AND x.dikonfirmasi_pada IS NULL)
         -- Data lama menyimpan ratusan serah terima tanpa tanda konfirmasi pada
         -- pengajuan yang sudah lama selesai. Tanpa syarat ini, penerimanya
         -- diingatkan untuk alat yang sudah dikembalikan bertahun-tahun lalu.
         AND pm.status IN ('SENT','PARTIAL SENT','PARTIAL RECEIVED','RETURN','PARTIAL RETURN')
    `);

    return baris.map((r) => ({
      serahTerimaId: Number(r.SERAH_TERIMA_ID),
      peminjamanId: Number(r.PEMINJAMAN_ID),
      penerimaId: r.PEMINJAM_ID === null ? null : Number(r.PEMINJAM_ID),
      penerimaEmail: (r.PENERIMA_EMAIL as string) ?? null,
      namaPenerima: (r.NAMA_PENERIMA as string) ?? 'Peminjam',
      jumlahBelum: Number(r.JUMLAH_BELUM ?? 0),
      diserahkanPada: new Date(String(r.DISERAHKAN_PADA)),
      sudahDikirim: bacaJenjang(r.SUDAH as string | null),
    }));
  }

  /** Peminjaman berjalan yang mendekati atau melewati tanggal pengembalian. */
  async calonPengembalian(): Promise<CalonPengingatPengembalian[]> {
    const baris = await this.db.kueri<Record<string, unknown>>(`
      SELECT pm.id AS peminjaman_id, pm.tanggal_selesai, pm.peminjam_id,
             p.email AS penerima_email,
             NVL(p.nama, pm.nama_peminjam_historis) AS nama_penerima,
             (SELECT COUNT(*) FROM peminjaman_alat pa WHERE pa.peminjaman_id = pm.id) AS jumlah_alat,
             (SELECT LISTAGG(n.perihal, '|') WITHIN GROUP (ORDER BY n.id)
                FROM notifikasi n
               WHERE n.entitas = 'PEMINJAMAN' AND n.entitas_id = pm.id
                 AND n.status IN ('TERKIRIM','MENUNGGU')) AS sudah
        FROM peminjaman pm
        LEFT JOIN pengguna p ON p.id = pm.peminjam_id
       WHERE UPPER(pm.status) IN ('RECEIVED','PARTIAL RECEIVED','SENT','PARTIAL SENT')
         AND pm.tanggal_selesai IS NOT NULL
    `);

    return baris.map((r) => ({
      peminjamanId: Number(r.PEMINJAMAN_ID),
      penerimaId: r.PEMINJAM_ID === null ? null : Number(r.PEMINJAM_ID),
      penerimaEmail: (r.PENERIMA_EMAIL as string) ?? null,
      namaPenerima: (r.NAMA_PENERIMA as string) ?? 'Peminjam',
      jumlahAlat: Number(r.JUMLAH_ALAT ?? 0),
      tanggalSelesai: new Date(String(r.TANGGAL_SELESAI)),
      sudahDikirim: bacaJenjang(r.SUDAH as string | null),
    }));
  }

  async antrekan(masukan: {
    penerimaId: number | null;
    penerimaEmail: string | null;
    kanal: Kanal;
    perihal: string;
    isi: string;
    tautan: string | null;
    entitas: string;
    entitasId: number;
  }): Promise<number> {
    return this.db.transaksi(async (koneksi) => {
      const hasil = await koneksi.execute<{ id: number[] }>(
        `
        INSERT INTO notifikasi (penerima_id, penerima_email, kanal, perihal, isi,
                                tautan, entitas, entitas_id, jadwal_kirim, status)
        VALUES (:penerimaId, :penerimaEmail, :kanal, :perihal, :isi,
                :tautan, :entitas, :entitasId, SYSTIMESTAMP, 'MENUNGGU')
        RETURNING id INTO :id
        `,
        { ...masukan, id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
      );
      return Number(hasil.outBinds?.id?.[0]);
    });
  }

  /** Notifikasi yang sudah waktunya dikirim. */
  async siapKirim(batas = 50) {
    return this.db.kueri(
      `
      SELECT id, penerima_email, kanal, perihal, isi, tautan, percobaan
        FROM notifikasi
       WHERE status = 'MENUNGGU' AND jadwal_kirim <= SYSTIMESTAMP
       ORDER BY jadwal_kirim
       FETCH FIRST :batas ROWS ONLY
      `,
      { batas },
    );
  }

  async tandaiTerkirim(id: number): Promise<void> {
    await this.db.transaksi(async (koneksi) => {
      await koneksi.execute(
        `UPDATE notifikasi SET status = 'TERKIRIM', terkirim_pada = SYSTIMESTAMP,
                percobaan = percobaan + 1
          WHERE id = :id`,
        { id },
      );
    });
  }

  /**
   * Mencatat kegagalan pengiriman tanpa membuangnya.
   *
   * Setelah lima percobaan notifikasi berhenti dicoba, tetapi barisnya tetap
   * ada beserta galat terakhirnya — sistem lama tidak mencatat apa pun,
   * sehingga tidak ada cara mengetahui pengingat mana yang tidak sampai.
   */
  async tandaiGagal(id: number, galat: string, batasPercobaan = 5): Promise<void> {
    await this.db.transaksi(async (koneksi) => {
      await koneksi.execute(
        `
        UPDATE notifikasi
           SET percobaan = percobaan + 1,
               galat_terakhir = :galat,
               status = CASE WHEN percobaan + 1 >= :batas THEN 'GAGAL' ELSE 'MENUNGGU' END
         WHERE id = :id
        `,
        { galat: galat.slice(0, 1000), batas: batasPercobaan, id },
      );
    });
  }

  async ringkasan() {
    const baris = await this.db.kueri<Record<string, unknown>>(
      `SELECT status, kanal, COUNT(*) AS jumlah FROM notifikasi GROUP BY status, kanal`,
    );
    return baris.map((r) => ({
      status: r.STATUS as string,
      kanal: r.KANAL as string,
      jumlah: Number(r.JUMLAH),
    }));
  }
}

/** Jenjang dibaca dari perihal notifikasi yang sudah pernah dibuat. */
function bacaJenjang(gabungan: string | null): JenjangPengingat[] {
  if (!gabungan) return [];
  const hasil: JenjangPengingat[] = [];
  for (const bagian of gabungan.split('|')) {
    const cocok = bagian.match(/\[(H1|H3|H7|JATUH_TEMPO|TERLAMBAT)\]/);
    if (cocok?.[1]) hasil.push(cocok[1] as JenjangPengingat);
  }
  return hasil;
}
