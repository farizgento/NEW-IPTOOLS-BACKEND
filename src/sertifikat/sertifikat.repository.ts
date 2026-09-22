import { Injectable } from '@nestjs/common';
import oracledb from 'oracledb';
import { OracleService } from '../basisdata/oracle.service';
import {
  HARI_SEGERA,
  bakukanHasil,
  statusSertifikat,
  type IsiSertifikat,
  type StatusSertifikat,
} from './sertifikat';

export interface Sertifikat {
  id: number;
  alatId: number;
  nomor: string | null;
  tanggalKalibrasi: string | null;
  tanggalSaran: string | null;
  hasil: string | null;
  hasilBaku: string | null;
  pelaksana: string | null;
  berkas: number;
  status: StatusSertifikat;
  sisaHari: number | null;
}

export interface BarisAlatSertifikat {
  alatId: number;
  kodeBarcode: string | null;
  nama: string;
  unit: string | null;
  jumlahSertifikat: number;
  terakhir: Sertifikat;
}

export interface FilterSertifikat {
  cari?: string | undefined;
  unitId?: number | undefined;
  status?: StatusSertifikat | 'TANPA_BERKAS' | undefined;
  pelaksana?: string | undefined;
  halaman: number;
  perHalaman: number;
}

/** Sertifikat terbaru satu alat; dipakai berulang, jadi ditulis sekali di sini. */
const TERBARU = `
  SELECT s.*,
         ROW_NUMBER() OVER (
           PARTITION BY s.alat_id
           ORDER BY s.tanggal_kalibrasi DESC NULLS LAST, s.id DESC
         ) AS urutan
    FROM alat_sertifikat s
`;

const JUMLAH_BERKAS = `
  (SELECT COUNT(*) FROM lampiran l
    WHERE l.entitas = 'ALAT_SERTIFIKAT' AND l.entitas_id = s.id)
`;

interface BarisSertifikat extends Record<string, unknown> {
  ID: number;
  ALAT_ID: number;
  NOMOR: string | null;
  TGL_KALIBRASI: string | null;
  TGL_SARAN: string | null;
  HASIL: string | null;
  PELAKSANA: string | null;
  BERKAS: number;
}

function keSertifikat(b: BarisSertifikat, hariIni: string): Sertifikat {
  const { status, sisaHari } = statusSertifikat(b.TGL_SARAN, hariIni);
  return {
    id: Number(b.ID),
    alatId: Number(b.ALAT_ID),
    nomor: b.NOMOR,
    tanggalKalibrasi: b.TGL_KALIBRASI,
    tanggalSaran: b.TGL_SARAN,
    hasil: b.HASIL,
    hasilBaku: bakukanHasil(b.HASIL),
    pelaksana: b.PELAKSANA,
    berkas: Number(b.BERKAS ?? 0),
    status,
    sisaHari,
  };
}

/** Hanya ikatan yang benar-benar muncul di SQL yang boleh dikirim ke Oracle. */
function ikatanTerpakai(sql: string, ikatan: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(ikatan).filter(([kunci]) => sql.includes(`:${kunci}`)),
  );
}

@Injectable()
export class SertifikatRepository {
  constructor(private readonly db: OracleService) {}

  /**
   * Angka di kepala layar: dihitung dari sertifikat terbaru setiap alat, bukan
   * dari seluruh baris, sebab yang menentukan status alat hanya yang terakhir.
   */
  async ringkasan(hariIni: string): Promise<{
    alat: number;
    sertifikat: number;
    lewat: number;
    segera: number;
    tanpaTanggal: number;
    tanpaBerkas: number;
  }> {
    // Dua kueri: Oracle menolak subkueri skalar di antara fungsi agregat (ORA-00937).
    const [baris, semua] = await Promise.all([
      this.db.kueriSatu<{
        ALAT: number;
        LEWAT: number;
        SEGERA: number;
        TANPA_TANGGAL: number;
        TANPA_BERKAS: number;
      }>(
      `
      WITH t AS (${TERBARU})
      SELECT COUNT(*) AS alat,
             SUM(CASE WHEN t.tanggal_saran < TO_DATE(:hariIni,'YYYY-MM-DD') THEN 1 ELSE 0 END) AS lewat,
             SUM(CASE WHEN t.tanggal_saran >= TO_DATE(:hariIni,'YYYY-MM-DD')
                       AND t.tanggal_saran <= TO_DATE(:hariIni,'YYYY-MM-DD') + :jeda THEN 1 ELSE 0 END) AS segera,
             SUM(CASE WHEN t.tanggal_saran IS NULL THEN 1 ELSE 0 END) AS tanpa_tanggal,
             SUM(CASE WHEN NOT EXISTS (
                   SELECT 1 FROM lampiran l
                    WHERE l.entitas = 'ALAT_SERTIFIKAT' AND l.entitas_id = t.id) THEN 1 ELSE 0 END) AS tanpa_berkas
        FROM t
        JOIN alat a ON a.id = t.alat_id AND a.dihapus_pada IS NULL
       WHERE t.urutan = 1
      `,
        { hariIni, jeda: HARI_SEGERA },
      ),
      this.db.kueriSatu<{ SERTIFIKAT: number }>(
        `SELECT COUNT(*) AS sertifikat FROM alat_sertifikat s
           JOIN alat a ON a.id = s.alat_id AND a.dihapus_pada IS NULL`,
      ),
    ]);
    return {
      alat: Number(baris?.ALAT ?? 0),
      sertifikat: Number(semua?.SERTIFIKAT ?? 0),
      lewat: Number(baris?.LEWAT ?? 0),
      segera: Number(baris?.SEGERA ?? 0),
      tanpaTanggal: Number(baris?.TANPA_TANGGAL ?? 0),
      tanpaBerkas: Number(baris?.TANPA_BERKAS ?? 0),
    };
  }

  /** Satu baris per alat, berisi sertifikat terbarunya. Paling mendesak di atas. */
  async daftar(
    filter: FilterSertifikat,
    hariIni: string,
  ): Promise<{ isi: BarisAlatSertifikat[]; total: number; halaman: number; perHalaman: number }> {
    const ikatan: Record<string, unknown> = { hariIni, jeda: HARI_SEGERA };
    const syarat = ['t.urutan = 1', 'a.dihapus_pada IS NULL'];

    if (filter.cari?.trim()) {
      ikatan.cari = `%${filter.cari.trim().toUpperCase()}%`;
      syarat.push(`(UPPER(a.nama) LIKE :cari OR UPPER(a.kode_barcode) LIKE :cari
                    OR UPPER(t.nomor) LIKE :cari OR UPPER(t.pelaksana) LIKE :cari)`);
    }
    if (filter.unitId) {
      ikatan.unitId = filter.unitId;
      syarat.push('a.unit_id = :unitId');
    }
    if (filter.pelaksana?.trim()) {
      ikatan.pelaksana = filter.pelaksana.trim().toUpperCase();
      syarat.push('UPPER(t.pelaksana) = :pelaksana');
    }
    if (filter.status === 'LEWAT') syarat.push(`t.tanggal_saran < TO_DATE(:hariIni,'YYYY-MM-DD')`);
    if (filter.status === 'SEGERA')
      syarat.push(`t.tanggal_saran BETWEEN TO_DATE(:hariIni,'YYYY-MM-DD')
                   AND TO_DATE(:hariIni,'YYYY-MM-DD') + :jeda`);
    if (filter.status === 'BERLAKU')
      syarat.push(`t.tanggal_saran > TO_DATE(:hariIni,'YYYY-MM-DD') + :jeda`);
    if (filter.status === 'TANPA_TANGGAL') syarat.push('t.tanggal_saran IS NULL');
    if (filter.status === 'TANPA_BERKAS')
      syarat.push(`NOT EXISTS (SELECT 1 FROM lampiran l
                    WHERE l.entitas = 'ALAT_SERTIFIKAT' AND l.entitas_id = t.id)`);

    const dari = `
      WITH t AS (${TERBARU})
      SELECT t.id, t.alat_id, TRIM(t.nomor) AS nomor,
             TO_CHAR(t.tanggal_kalibrasi,'YYYY-MM-DD') AS tgl_kalibrasi,
             TO_CHAR(t.tanggal_saran,'YYYY-MM-DD') AS tgl_saran,
             TRIM(t.hasil) AS hasil, TRIM(t.pelaksana) AS pelaksana,
             (SELECT COUNT(*) FROM lampiran l
               WHERE l.entitas = 'ALAT_SERTIFIKAT' AND l.entitas_id = t.id) AS berkas,
             TRIM(a.kode_barcode) AS kode_barcode, TRIM(a.nama) AS nama, TRIM(u.nama) AS unit,
             (SELECT COUNT(*) FROM alat_sertifikat s2 WHERE s2.alat_id = t.alat_id) AS jumlah
        FROM t
        JOIN alat a ON a.id = t.alat_id
        LEFT JOIN unit u ON u.id = a.unit_id
       WHERE ${syarat.join(' AND ')}
    `;

    const sqlJumlah = `SELECT COUNT(*) AS total FROM (${dari})`;
    const jumlah = await this.db.kueriSatu<{ TOTAL: number }>(
      sqlJumlah,
      // Oracle menolak ikatan yang tidak dipakai, dan saringan di atas bersifat pilihan.
      ikatanTerpakai(sqlJumlah, ikatan),
    );

    /**
     * Urutan: kedaluwarsa dulu, lalu yang segera habis, lalu yang tanpa tanggal.
     * Inilah urutan kerja petugas, bukan urutan abjad.
     */
    const rows = await this.db.kueri<BarisSertifikat & { KODE_BARCODE: string | null; NAMA: string; UNIT: string | null; JUMLAH: number }>(
      `
      SELECT * FROM (${dari})
       ORDER BY CASE
                  WHEN tgl_saran IS NULL THEN 2
                  WHEN TO_DATE(tgl_saran,'YYYY-MM-DD') < TO_DATE(:hariIni,'YYYY-MM-DD') THEN 0
                  WHEN TO_DATE(tgl_saran,'YYYY-MM-DD') <= TO_DATE(:hariIni,'YYYY-MM-DD') + :jeda THEN 1
                  ELSE 3 END,
                tgl_saran,
                nama
       OFFSET :lewati ROWS FETCH NEXT :ambil ROWS ONLY
      `,
      { ...ikatan, lewati: (filter.halaman - 1) * filter.perHalaman, ambil: filter.perHalaman },
    );

    return {
      isi: rows.map((b) => ({
        alatId: Number(b.ALAT_ID),
        kodeBarcode: b.KODE_BARCODE,
        nama: b.NAMA,
        unit: b.UNIT,
        jumlahSertifikat: Number(b.JUMLAH ?? 0),
        terakhir: keSertifikat(b, hariIni),
      })),
      total: Number(jumlah?.TOTAL ?? 0),
      halaman: filter.halaman,
      perHalaman: filter.perHalaman,
    };
  }

  /** Seluruh sertifikat satu alat, terbaru di atas. Sertifikat lama tidak pernah ditimpa. */
  async riwayat(alatId: number, hariIni: string): Promise<Sertifikat[]> {
    const rows = await this.db.kueri<BarisSertifikat>(
      `
      SELECT s.id, s.alat_id, TRIM(s.nomor) AS nomor,
             TO_CHAR(s.tanggal_kalibrasi,'YYYY-MM-DD') AS tgl_kalibrasi,
             TO_CHAR(s.tanggal_saran,'YYYY-MM-DD') AS tgl_saran,
             TRIM(s.hasil) AS hasil, TRIM(s.pelaksana) AS pelaksana,
             ${JUMLAH_BERKAS} AS berkas
        FROM alat_sertifikat s
       WHERE s.alat_id = :alatId
       ORDER BY s.tanggal_kalibrasi DESC NULLS LAST, s.id DESC
      `,
      { alatId },
    );
    return rows.map((b) => keSertifikat(b, hariIni));
  }

  async satu(id: number, hariIni: string): Promise<Sertifikat | undefined> {
    const b = await this.db.kueriSatu<BarisSertifikat>(
      `
      SELECT s.id, s.alat_id, TRIM(s.nomor) AS nomor,
             TO_CHAR(s.tanggal_kalibrasi,'YYYY-MM-DD') AS tgl_kalibrasi,
             TO_CHAR(s.tanggal_saran,'YYYY-MM-DD') AS tgl_saran,
             TRIM(s.hasil) AS hasil, TRIM(s.pelaksana) AS pelaksana,
             ${JUMLAH_BERKAS} AS berkas
        FROM alat_sertifikat s
       WHERE s.id = :id
      `,
      { id },
    );
    return b ? keSertifikat(b, hariIni) : undefined;
  }

  async alatAda(alatId: number): Promise<boolean> {
    const b = await this.db.kueriSatu<{ ADA: number }>(
      'SELECT 1 AS ada FROM alat WHERE id = :alatId AND dihapus_pada IS NULL',
      { alatId },
    );
    return !!b;
  }

  /** Daftar nama pelaksana untuk saringan dan saran isian. */
  async pelaksana(): Promise<{ nama: string; jumlah: number }[]> {
    const rows = await this.db.kueri<{ NAMA: string; JUMLAH: number }>(
      `SELECT TRIM(pelaksana) AS nama, COUNT(*) AS jumlah
         FROM alat_sertifikat
        WHERE pelaksana IS NOT NULL AND TRIM(pelaksana) IS NOT NULL
        GROUP BY TRIM(pelaksana)
        ORDER BY TRIM(pelaksana)`,
    );
    return rows.map((r) => ({ nama: r.NAMA, jumlah: Number(r.JUMLAH) }));
  }

  async tambah(alatId: number, isi: IsiSertifikat, oleh: number): Promise<number> {
    return this.db.transaksi(async (koneksi) => {
      const hasil = await koneksi.execute<{ id: number[] }>(
        `
        INSERT INTO alat_sertifikat (
          alat_id, nomor, tanggal_kalibrasi, tanggal_saran, hasil, pelaksana, id_lama)
        VALUES (:alatId, :nomor, TO_DATE(:kalibrasi,'YYYY-MM-DD'),
                CASE WHEN :saran IS NULL THEN NULL ELSE TO_DATE(:saran,'YYYY-MM-DD') END,
                :hasil, :pelaksana, NULL)
        RETURNING id INTO :id
        `,
        {
          alatId,
          nomor: isi.nomor.trim(),
          kalibrasi: isi.tanggalKalibrasi,
          saran: isi.tanggalSaran,
          hasil: isi.hasil,
          pelaksana: isi.pelaksana,
          id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        },
      );
      void oleh; // pencatat perubahan master data belum ada tabelnya (PRD §9.4)
      return Number(hasil.outBinds?.id?.[0]);
    });
  }

  async ubah(id: number, isi: IsiSertifikat): Promise<void> {
    await this.db.transaksi(async (koneksi) => {
      await koneksi.execute(
        `
        UPDATE alat_sertifikat
           SET nomor = :nomor,
               tanggal_kalibrasi = TO_DATE(:kalibrasi,'YYYY-MM-DD'),
               tanggal_saran = CASE WHEN :saran IS NULL THEN NULL ELSE TO_DATE(:saran,'YYYY-MM-DD') END,
               hasil = :hasil,
               pelaksana = :pelaksana
         WHERE id = :id
        `,
        {
          id,
          nomor: isi.nomor.trim(),
          kalibrasi: isi.tanggalKalibrasi,
          saran: isi.tanggalSaran,
          hasil: isi.hasil,
          pelaksana: isi.pelaksana,
        },
      );
    });
  }
}
