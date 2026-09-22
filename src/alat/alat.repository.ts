import { Injectable } from '@nestjs/common';
import { OracleService } from '../basisdata/oracle.service';
import { sqlFotoUtama } from '../lampiran/lampiran.repository';
import { STATUS_SELESAI } from '../peminjaman/alur';

export interface FilterKatalog {
  kelompok?: boolean;
  urut?: 'nama' | 'tersedia';
  cari?: string | undefined;
  unitId?: number | undefined;
  bidangId?: number | undefined;
  hanyaTersedia?: boolean | undefined;
  halaman: number;
  perHalaman: number;
}

export interface RingkasanAlat {
  model: string;
  id: number;
  kodeBarcode: string | null;
  nama: string;
  namaPanggilan: string | null;
  spesifikasi: string | null;
  jenis: string | null;
  kondisi: string | null;
  lokasi: string | null;
  unit: string | null;
  bidang: string | null;
  tersedia: boolean;
  dipakaiSampai: string | null;
}

export interface HalamanKatalog {
  isi: RingkasanAlat[];
  total: number;
  halaman: number;
  perHalaman: number;
}

// Daftar status yang menandai pengajuan sudah tidak memakai alatnya lagi.
const IKATAN_SELESAI = STATUS_SELESAI.reduce<Record<string, string>>((akumulasi, status, i) => {
  akumulasi[`selesai${i}`] = status;
  return akumulasi;
}, {});
const PLACEHOLDER_SELESAI = Object.keys(IKATAN_SELESAI)
  .map((k) => `:${k}`)
  .join(', ');

/**
 * Ketersediaan dihitung, tidak disimpan (PRD 6.1 butir 6). Sistem lama menyimpan
 * DAFTAR_TOOL.STATUS sebagai penanda dipinjam, dan nilai itu bisa basi ketika
 * peminjamannya berubah lewat jalur lain.
 */
const PEMAKAIAN_BERJALAN = `
  SELECT pa.alat_id,
         MAX(pm.tanggal_selesai) AS sampai
    FROM peminjaman_alat pa
    JOIN peminjaman pm ON pm.id = pa.peminjaman_id
   WHERE UPPER(pm.status) NOT IN (${PLACEHOLDER_SELESAI})
   GROUP BY pa.alat_id
`;

// Kunci model yang sama dengan prototipe; unit fisik tetap memiliki id sendiri.
const MODEL = `TRIM(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(
  LOWER(a.nama), '(^| )(merk|merek)( |$)', ' '), '#[[:space:]]*[a-z0-9]{1,2}($| )', ' '),
  '\\([0-9]{4}\\)', ' '), '[^a-z0-9]+', ' '))`;

@Injectable()
export class AlatRepository {
  constructor(private readonly db: OracleService) {}

  async katalog(filter: FilterKatalog): Promise<HalamanKatalog> {
    const ikatan: Record<string, unknown> = { ...IKATAN_SELESAI };
    const syarat: string[] = ['a.dihapus_pada IS NULL'];

    if (filter.cari?.trim()) {
      // Satu kotak pencarian mencakup nama, nama panggilan, kode barcode, dan
      // spesifikasi (PRD F1).
      ikatan.cari = `%${filter.cari.trim().toUpperCase()}%`;
      syarat.push(`(
        UPPER(a.nama)           LIKE :cari OR
        UPPER(a.nama_panggilan) LIKE :cari OR
        UPPER(a.kode_barcode)   LIKE :cari OR
        UPPER(a.spesifikasi)    LIKE :cari
      )`);
    }
    if (filter.unitId) {
      ikatan.unitId = filter.unitId;
      syarat.push('a.unit_id = :unitId');
    }
    if (filter.bidangId) {
      ikatan.bidangId = filter.bidangId;
      syarat.push('a.bidang_id = :bidangId');
    }
    if (filter.hanyaTersedia && !filter.kelompok) {
      syarat.push('pakai.alat_id IS NULL');
    }

    const dari = `
      FROM alat a
      LEFT JOIN unit      u  ON u.id  = a.unit_id
      LEFT JOIN bidang    b  ON b.id  = a.bidang_id
      LEFT JOIN referensi rj ON rj.id = a.jenis_id
      LEFT JOIN referensi rk ON rk.id = a.kondisi_id
      LEFT JOIN referensi rl ON rl.id = a.lokasi_id
      LEFT JOIN (${PEMAKAIAN_BERJALAN}) pakai ON pakai.alat_id = a.id
      WHERE ${syarat.join(' AND ')}
    `;

    const jumlah = await this.db.kueriSatu<{ TOTAL: number }>(
      filter.kelompok
        ? `SELECT COUNT(*) AS total FROM (SELECT ${MODEL} AS model ${dari} GROUP BY ${MODEL} ${filter.hanyaTersedia ? 'HAVING MAX(CASE WHEN pakai.alat_id IS NULL THEN 1 ELSE 0 END) = 1' : ''})`
        : `SELECT COUNT(*) AS total ${dari}`,
      ikatan,
    );

    // Paging dikerjakan basis data, bukan klien — halaman lama mengunduh
    // seluruh daftar alat sekaligus.
    const mulai = (filter.halaman - 1) * filter.perHalaman;
    const baris = await this.db.kueri<Record<string, unknown>>(
      `
      ${filter.kelompok ? `SELECT * FROM (SELECT calon.*, DENSE_RANK() OVER (ORDER BY ${filter.urut === 'tersedia' ? 'stok_model DESC,' : ''} model) AS urutan_model FROM (` : ''}
      SELECT ${MODEL} AS model,
             ${filter.kelompok ? `SUM(CASE WHEN pakai.alat_id IS NULL THEN 1 ELSE 0 END) OVER (PARTITION BY ${MODEL}) AS stok_model,` : ''}
             a.id, a.kode_barcode, a.nama, a.nama_panggilan, a.spesifikasi,
             rj.nama AS jenis, rk.nama AS kondisi, rl.nama AS lokasi,
             u.nama  AS unit,  b.nama AS bidang,
             pakai.alat_id AS sedang_dipakai,
             pakai.sampai  AS dipakai_sampai,
             ${sqlFotoUtama('a.id')} AS foto_id
      ${dari}
      ${filter.kelompok
        ? `) calon ${filter.hanyaTersedia ? 'WHERE stok_model > 0' : ''}) WHERE urutan_model > :mulai AND urutan_model <= :mulai + :ambil ORDER BY urutan_model, id`
        : 'ORDER BY a.nama, a.id OFFSET :mulai ROWS FETCH NEXT :ambil ROWS ONLY'}
      `,
      { ...ikatan, mulai, ambil: filter.perHalaman },
    );

    return {
      isi: baris.map((r) => ({
        model: String(r.MODEL ?? r.NAMA ?? r.ID),
        id: Number(r.ID),
        kodeBarcode: (r.KODE_BARCODE as string) ?? null,
        nama: r.NAMA as string,
        namaPanggilan: (r.NAMA_PANGGILAN as string) ?? null,
        spesifikasi: (r.SPESIFIKASI as string) ?? null,
        jenis: (r.JENIS as string) ?? null,
        kondisi: (r.KONDISI as string) ?? null,
        lokasi: (r.LOKASI as string) ?? null,
        unit: (r.UNIT as string) ?? null,
        bidang: (r.BIDANG as string) ?? null,
        tersedia: r.SEDANG_DIPAKAI === null,
        dipakaiSampai: r.DIPAKAI_SAMPAI ? String(r.DIPAKAI_SAMPAI) : null,
        fotoId: r.FOTO_ID == null ? null : Number(r.FOTO_ID),
      })),
      total: Number(jumlah?.TOTAL ?? 0),
      halaman: filter.halaman,
      perHalaman: filter.perHalaman,
    };
  }

  /**
   * Satu alat beserta kelengkapannya: aksesoris, foto dan manual, sertifikat
   * kalibrasi terakhir, serta kolom nilai yang dipakai laporan efektivitas.
   *
   * Kolom estimasi ikut agar pengelola dapat memeriksanya tanpa membuka laporan.
   */
  async detail(id: number) {
    const a = await this.db.kueriSatu<Record<string, unknown>>(
      `
      SELECT a.id, TRIM(a.kode_barcode) AS kode_barcode, TRIM(a.nama) AS nama,
             TRIM(a.nama_panggilan) AS nama_panggilan, a.spesifikasi, a.fungsi,
             a.jenis_id, rj.nama AS jenis, a.kondisi_id, rk.nama AS kondisi,
             a.lokasi_id, rl.nama AS lokasi, a.unit_id, u.nama AS unit,
             a.bidang_id, b.nama AS bidang, a.persen_kondisi,
             TRIM(a.kode_maximo) AS kode_maximo, TRIM(a.nomor_aset) AS nomor_aset,
             a.tahun_perolehan, a.nilai_kontrak, a.masa_manfaat,
             a.estimasi_pertahun, a.estimasi_persurat, a.status, a.status_perbaikan,
             pakai.alat_id AS sedang_dipakai, TO_CHAR(pakai.sampai,'YYYY-MM-DD') AS dipakai_sampai
        FROM alat a
        LEFT JOIN unit u ON u.id = a.unit_id
        LEFT JOIN bidang b ON b.id = a.bidang_id
        LEFT JOIN referensi rj ON rj.id = a.jenis_id
        LEFT JOIN referensi rk ON rk.id = a.kondisi_id
        LEFT JOIN referensi rl ON rl.id = a.lokasi_id
        LEFT JOIN (${PEMAKAIAN_BERJALAN}) pakai ON pakai.alat_id = a.id
       WHERE a.id = :id AND a.dihapus_pada IS NULL
      `,
      { ...IKATAN_SELESAI, id },
    );
    if (!a) return undefined;

    const [aksesoris, lampiran, sertifikat] = await Promise.all([
      this.db.kueri(
        `SELECT id, TRIM(nama) AS nama, jumlah, TRIM(satuan) AS satuan, standar, standar_jalan
           FROM alat_aksesoris WHERE alat_id = :id ORDER BY nama`,
        { id },
      ),
      this.db.kueri(
        `SELECT id, jenis, TRIM(nama_berkas) AS nama_berkas, tipe_media, ukuran_bita, berkas_hilang,
                CASE WHEN lokasi IS NULL THEN 0 ELSE 1 END AS tersimpan
           FROM lampiran WHERE entitas = 'ALAT' AND entitas_id = :id ORDER BY urutan, id`,
        { id },
      ),
      this.db.kueriSatu(
        `SELECT s.id, TRIM(s.nomor) AS nomor,
                TO_CHAR(s.tanggal_kalibrasi,'YYYY-MM-DD') AS tanggal_kalibrasi,
                TO_CHAR(s.tanggal_saran,'YYYY-MM-DD') AS tanggal_saran,
                TRIM(s.hasil) AS hasil, TRIM(s.pelaksana) AS pelaksana
           FROM alat_sertifikat s
          WHERE s.alat_id = :id
          ORDER BY s.tanggal_kalibrasi DESC NULLS LAST, s.id DESC
          FETCH FIRST 1 ROWS ONLY`,
        { id },
      ),
    ]);

    return {
      id: Number(a.ID),
      kodeBarcode: (a.KODE_BARCODE as string) ?? null,
      nama: a.NAMA as string,
      namaPanggilan: (a.NAMA_PANGGILAN as string) ?? null,
      spesifikasi: (a.SPESIFIKASI as string) ?? null,
      fungsi: (a.FUNGSI as string) ?? null,
      jenis: (a.JENIS as string) ?? null,
      jenisId: a.JENIS_ID === null ? null : Number(a.JENIS_ID),
      kondisi: (a.KONDISI as string) ?? null,
      kondisiId: a.KONDISI_ID === null ? null : Number(a.KONDISI_ID),
      lokasi: (a.LOKASI as string) ?? null,
      lokasiId: a.LOKASI_ID === null ? null : Number(a.LOKASI_ID),
      unit: (a.UNIT as string) ?? null,
      unitId: a.UNIT_ID === null ? null : Number(a.UNIT_ID),
      bidang: (a.BIDANG as string) ?? null,
      bidangId: a.BIDANG_ID === null ? null : Number(a.BIDANG_ID),
      persenKondisi: a.PERSEN_KONDISI === null ? null : Number(a.PERSEN_KONDISI),
      kodeMaximo: (a.KODE_MAXIMO as string) ?? null,
      nomorAset: (a.NOMOR_ASET as string) ?? null,
      tahunPerolehan: a.TAHUN_PEROLEHAN === null ? null : Number(a.TAHUN_PEROLEHAN),
      nilaiKontrak: a.NILAI_KONTRAK === null ? null : Number(a.NILAI_KONTRAK),
      masaManfaat: a.MASA_MANFAAT === null ? null : Number(a.MASA_MANFAAT),
      estimasiPertahun: a.ESTIMASI_PERTAHUN === null ? null : Number(a.ESTIMASI_PERTAHUN),
      estimasiPersurat: a.ESTIMASI_PERSURAT === null ? null : Number(a.ESTIMASI_PERSURAT),
      tersedia: a.SEDANG_DIPAKAI === null,
      dipakaiSampai: (a.DIPAKAI_SAMPAI as string) ?? null,
      aksesoris,
      lampiran,
      sertifikatTerakhir: sertifikat ?? null,
    };
  }

  async unitPemilik(alatIds: number[]): Promise<Map<number, number | null>> {
    if (!alatIds.length) return new Map();
    const ikatan: Record<string, unknown> = {};
    const nama = alatIds.map((id, i) => {
      ikatan[`a${i}`] = id;
      return `:a${i}`;
    });
    const baris = await this.db.kueri<{ ID: number; UNIT_ID: number | null }>(
      `SELECT id, unit_id FROM alat WHERE id IN (${nama.join(',')}) AND dihapus_pada IS NULL`,
      ikatan,
    );
    return new Map(baris.map((r) => [Number(r.ID), r.UNIT_ID === null ? null : Number(r.UNIT_ID)]));
  }
}
