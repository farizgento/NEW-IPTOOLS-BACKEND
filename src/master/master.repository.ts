import { Injectable } from '@nestjs/common';
import oracledb from 'oracledb';
import { OracleService } from '../basisdata/oracle.service';

export const TIPE_REFERENSI = [
  'JENIS_ALAT',
  'KONDISI_ALAT',
  'LOKASI_ALAT',
  'TIPE_OH',
  'JENIS_ALUR',
  'TINGKAT_KERUSAKAN',
  'KATEGORI_PEMINJAMAN',
] as const;
export type TipeReferensi = (typeof TIPE_REFERENSI)[number];

@Injectable()
export class MasterRepository {
  constructor(private readonly db: OracleService) {}

  /**
   * Daftar pilihan satu tipe.
   *
   * `dari_migrasi` menandai nilai yang didaftarkan saat migrasi karena dipakai
   * data lama tanpa pernah terdaftar (PRD 7.3) — 38 entri. Admin memakai tanda
   * itu untuk merapikan: menggabungkan yang kembar, membetulkan ejaan.
   */
  async referensi(tipe: TipeReferensi) {
    return this.db.kueri(
      `
      SELECT r.id, r.kode, r.nama, r.urutan, r.aktif, r.dari_migrasi,
             (SELECT COUNT(*) FROM alat a
               WHERE a.jenis_id = r.id OR a.kondisi_id = r.id OR a.lokasi_id = r.id) AS dipakai_alat
        FROM referensi r
       WHERE r.tipe = :tipe
       ORDER BY r.dari_migrasi, r.urutan, r.nama
      `,
      { tipe },
    );
  }

  async tambahReferensi(tipe: TipeReferensi, kode: string, nama: string): Promise<void> {
    await this.db.transaksi(async (koneksi) => {
      await koneksi.execute(
        `INSERT INTO referensi (tipe, kode, nama, urutan)
         VALUES (:tipe, :kode, :nama, (SELECT NVL(MAX(urutan),0)+1 FROM referensi WHERE tipe = :tipe))`,
        { tipe, kode, nama },
      );
    });
  }

  async ubahReferensi(id: number, nama: string, aktif: boolean): Promise<void> {
    await this.db.transaksi(async (koneksi) => {
      await koneksi.execute(
        `UPDATE referensi SET nama = :nama, aktif = :aktif, dari_migrasi = 0 WHERE id = :id`,
        { nama, aktif: aktif ? 1 : 0, id },
      );
    });
  }

  /**
   * Menggabungkan dua pilihan: seluruh alat yang memakai `dariId` dialihkan ke
   * `keId`, lalu pilihan lama dinonaktifkan.
   *
   * Diperlukan karena migrasi mendaftarkan nilai apa adanya, termasuk yang
   * sebenarnya ejaan berbeda dari hal yang sama.
   */
  async gabungReferensi(dariId: number, keId: number): Promise<number> {
    return this.db.transaksi(async (koneksi) => {
      let dialihkan = 0;
      for (const kolom of ['jenis_id', 'kondisi_id', 'lokasi_id']) {
        const hasil = await koneksi.execute(
          `UPDATE alat SET ${kolom} = :keId WHERE ${kolom} = :dariId`,
          { keId, dariId },
        );
        dialihkan += hasil.rowsAffected ?? 0;
      }
      await koneksi.execute('UPDATE referensi SET aktif = 0 WHERE id = :dariId', { dariId });
      return dialihkan;
    });
  }

  /**
   * Pengguna yang unitnya belum diketahui (PRD 6.2.1).
   *
   * Yang memegang peran didahulukan: unit menentukan isi antrean tugas mereka,
   * jadi merekalah yang wajib beres sebelum peluncuran.
   */
  async penggunaTanpaUnit(hanyaBerperan: boolean) {
    return this.db.kueri(
      `
      SELECT p.id, p.nama, p.email, p.nipeg, p.username, p.sumber_unit,
             (SELECT LISTAGG(r.peran, ',') WITHIN GROUP (ORDER BY r.peran)
                FROM pengguna_peran r WHERE r.pengguna_id = p.id) AS peran,
             (SELECT COUNT(*) FROM peminjaman pm WHERE pm.peminjam_id = p.id) AS jumlah_pengajuan
        FROM pengguna p
       WHERE p.duplikat_dari IS NULL
         AND p.unit_id IS NULL
         ${hanyaBerperan ? 'AND EXISTS (SELECT 1 FROM pengguna_peran r WHERE r.pengguna_id = p.id)' : ''}
       ORDER BY p.nama
      `,
    );
  }

  /** Menetapkan unit seorang pengguna, mencatat asal keputusannya. */
  async tetapkanUnit(penggunaId: number, unitId: number, sumber: string): Promise<void> {
    await this.db.transaksi(async (koneksi) => {
      await koneksi.execute(
        `UPDATE pengguna SET unit_id = :unitId, sumber_unit = :sumber WHERE id = :penggunaId`,
        { unitId, sumber, penggunaId },
      );
    });
  }

  async unit(termasukNonaktif = false) {
    return this.db.kueri(
      `SELECT u.id, u.nama, u.kode_re, u.kode_maximo, u.deskripsi,
              TO_CHAR(u.nonaktif_pada,'YYYY-MM-DD') AS nonaktif_pada,
              (SELECT COUNT(*) FROM alat a WHERE a.unit_id = u.id AND a.dihapus_pada IS NULL) AS jumlah_alat,
              (SELECT COUNT(*) FROM pengguna p WHERE p.unit_id = u.id AND p.duplikat_dari IS NULL) AS jumlah_pengguna
         FROM unit u
        ${termasukNonaktif ? '' : 'WHERE u.nonaktif_pada IS NULL'}
        ORDER BY u.nama`,
    );
  }

  async unitSatu(id: number) {
    return this.db.kueriSatu(
      `SELECT id, nama, kode_re, kode_maximo, deskripsi,
              TO_CHAR(nonaktif_pada,'YYYY-MM-DD') AS nonaktif_pada
         FROM unit WHERE id = :id`,
      { id },
    );
  }

  /** Nama unit tidak boleh kembar; pemeriksaannya di sini karena butuh basis data. */
  async unitBernamaSama(nama: string, kecualiId?: number): Promise<boolean> {
    const baris = await this.db.kueriSatu<{ ADA: number }>(
      `SELECT 1 AS ada FROM unit
        WHERE UPPER(TRIM(nama)) = :nama ${kecualiId ? 'AND id <> :kecualiId' : ''}
        FETCH FIRST 1 ROWS ONLY`,
      kecualiId
        ? { nama: nama.trim().toUpperCase(), kecualiId }
        : { nama: nama.trim().toUpperCase() },
    );
    return !!baris;
  }

  async tambahUnit(isi: {
    nama: string;
    kodeRe: number | null;
    kodeMaximo: string | null;
    deskripsi: string | null;
  }): Promise<number> {
    return this.db.transaksi(async (koneksi) => {
      const hasil = await koneksi.execute<{ id: number[] }>(
        `INSERT INTO unit (nama, kode_re, kode_maximo, deskripsi, id_lama)
         VALUES (:nama, :kodeRe, :kodeMaximo, :deskripsi, NULL)
         RETURNING id INTO :id`,
        {
          nama: isi.nama.trim(),
          kodeRe: isi.kodeRe,
          kodeMaximo: isi.kodeMaximo,
          deskripsi: isi.deskripsi,
          id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        },
      );
      return Number(hasil.outBinds?.id?.[0]);
    });
  }

  /**
   * Unit tidak pernah dihapus, hanya dinonaktifkan: alat dan riwayat peminjaman
   * lama masih menunjuk ke sana.
   */
  async ubahUnit(
    id: number,
    isi: {
      nama: string;
      kodeRe: number | null;
      kodeMaximo: string | null;
      deskripsi: string | null;
      nonaktif: boolean;
    },
  ): Promise<void> {
    await this.db.transaksi(async (koneksi) => {
      await koneksi.execute(
        `UPDATE unit
            SET nama = :nama, kode_re = :kodeRe, kode_maximo = :kodeMaximo, deskripsi = :deskripsi,
                nonaktif_pada = CASE WHEN :nonaktif = 1 THEN NVL(nonaktif_pada, SYSTIMESTAMP) ELSE NULL END
          WHERE id = :id`,
        {
          id,
          nama: isi.nama.trim(),
          kodeRe: isi.kodeRe,
          kodeMaximo: isi.kodeMaximo,
          deskripsi: isi.deskripsi,
          nonaktif: isi.nonaktif ? 1 : 0,
        },
      );
    });
  }

  /**
   * Daftar proyek beserta berapa kali namanya dipakai pengajuan.
   *
   * Pemakaian dicocokkan lewat nama, bukan kunci asing: sistem lama tidak
   * pernah menyimpan tautan antara peminjaman dan proyek.
   */
  async proyek(filter: {
    cari?: string | undefined;
    tanpaTipeOh?: boolean | undefined;
    halaman: number;
    perHalaman: number;
  }) {
    const ikatan: Record<string, unknown> = {};
    const syarat: string[] = [];
    if (filter.cari?.trim()) {
      ikatan.cari = `%${filter.cari.trim().toUpperCase()}%`;
      syarat.push('UPPER(p.nama_pekerjaan) LIKE :cari');
    }
    if (filter.tanpaTipeOh) syarat.push('p.tipe_oh_id IS NULL');
    const where = syarat.length ? `WHERE ${syarat.join(' AND ')}` : '';

    const jumlah = await this.db.kueriSatu<{ TOTAL: number }>(
      `SELECT COUNT(*) AS total FROM proyek p ${where}`,
      ikatan,
    );
    const isi = await this.db.kueri(
      `
      SELECT p.id, TRIM(p.nama_pekerjaan) AS nama,
             TO_CHAR(p.tanggal_mulai,'YYYY-MM-DD') AS tanggal_mulai,
             TO_CHAR(p.tanggal_selesai,'YYYY-MM-DD') AS tanggal_selesai,
             TRIM(p.siteco) AS site, p.tipe_oh_id, TRIM(r.nama) AS tipe_oh,
             (SELECT COUNT(*) FROM peminjaman pm
               WHERE UPPER(TRIM(pm.pekerjaan)) = UPPER(TRIM(p.nama_pekerjaan))) AS dipakai
        FROM proyek p
        LEFT JOIN referensi r ON r.id = p.tipe_oh_id
        ${where}
       ORDER BY p.tanggal_mulai DESC NULLS LAST, p.id DESC
       OFFSET :lewati ROWS FETCH NEXT :ambil ROWS ONLY
      `,
      { ...ikatan, lewati: (filter.halaman - 1) * filter.perHalaman, ambil: filter.perHalaman },
    );
    return {
      isi,
      total: Number(jumlah?.TOTAL ?? 0),
      halaman: filter.halaman,
      perHalaman: filter.perHalaman,
    };
  }

  async proyekSatu(id: number) {
    return this.db.kueriSatu(
      `SELECT id, TRIM(nama_pekerjaan) AS nama,
              TO_CHAR(tanggal_mulai,'YYYY-MM-DD') AS tanggal_mulai,
              TO_CHAR(tanggal_selesai,'YYYY-MM-DD') AS tanggal_selesai,
              TRIM(siteco) AS site, tipe_oh_id
         FROM proyek WHERE id = :id`,
      { id },
    );
  }

  async proyekBernamaSama(nama: string, kecualiId?: number): Promise<boolean> {
    const baris = await this.db.kueriSatu<{ ADA: number }>(
      `SELECT 1 AS ada FROM proyek
        WHERE UPPER(TRIM(nama_pekerjaan)) = :nama ${kecualiId ? 'AND id <> :kecualiId' : ''}
        FETCH FIRST 1 ROWS ONLY`,
      kecualiId
        ? { nama: nama.trim().toUpperCase(), kecualiId }
        : { nama: nama.trim().toUpperCase() },
    );
    return !!baris;
  }

  async tambahProyek(isi: {
    nama: string;
    tanggalMulai: string | null;
    tanggalSelesai: string | null;
    site: string | null;
    tipeOhId: number | null;
  }): Promise<number> {
    return this.db.transaksi(async (koneksi) => {
      const hasil = await koneksi.execute<{ id: number[] }>(
        `INSERT INTO proyek (nama_pekerjaan, tanggal_mulai, tanggal_selesai, siteco, tipe_oh_id, id_lama)
         VALUES (:nama,
                 CASE WHEN :mulai IS NULL THEN NULL ELSE TO_DATE(:mulai,'YYYY-MM-DD') END,
                 CASE WHEN :selesai IS NULL THEN NULL ELSE TO_DATE(:selesai,'YYYY-MM-DD') END,
                 :site, :tipeOhId, NULL)
         RETURNING id INTO :id`,
        {
          nama: isi.nama.trim(),
          mulai: isi.tanggalMulai,
          selesai: isi.tanggalSelesai,
          site: isi.site,
          tipeOhId: isi.tipeOhId,
          id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        },
      );
      return Number(hasil.outBinds?.id?.[0]);
    });
  }

  async ubahProyek(
    id: number,
    isi: {
      nama: string;
      tanggalMulai: string | null;
      tanggalSelesai: string | null;
      site: string | null;
      tipeOhId: number | null;
    },
  ): Promise<void> {
    await this.db.transaksi(async (koneksi) => {
      await koneksi.execute(
        `UPDATE proyek
            SET nama_pekerjaan = :nama,
                tanggal_mulai = CASE WHEN :mulai IS NULL THEN NULL ELSE TO_DATE(:mulai,'YYYY-MM-DD') END,
                tanggal_selesai = CASE WHEN :selesai IS NULL THEN NULL ELSE TO_DATE(:selesai,'YYYY-MM-DD') END,
                siteco = :site, tipe_oh_id = :tipeOhId
          WHERE id = :id`,
        {
          id,
          nama: isi.nama.trim(),
          mulai: isi.tanggalMulai,
          selesai: isi.tanggalSelesai,
          site: isi.site,
          tipeOhId: isi.tipeOhId,
        },
      );
    });
  }

  /**
   * Nama pekerjaan yang diketik bebas saat mengajukan dan belum ada di daftar
   * proyek. Menjadi antrean rapi-rapi admin, bukan penghalang pengajuan.
   */
  async pekerjaanLepas(batas: number) {
    return this.db.kueri(
      `
      SELECT UPPER(TRIM(pm.pekerjaan)) AS nama, COUNT(*) AS jumlah,
             TO_CHAR(MAX(pm.tanggal_mulai),'YYYY-MM-DD') AS terakhir
        FROM peminjaman pm
       WHERE pm.pekerjaan IS NOT NULL
         AND TRIM(pm.pekerjaan) IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM proyek p
                          WHERE UPPER(TRIM(p.nama_pekerjaan)) = UPPER(TRIM(pm.pekerjaan)))
       GROUP BY UPPER(TRIM(pm.pekerjaan))
       ORDER BY MAX(pm.tanggal_mulai) DESC NULLS LAST
       FETCH FIRST :batas ROWS ONLY
      `,
      { batas },
    );
  }

  async jumlahPekerjaanLepas(): Promise<{ pengajuan: number; unik: number }> {
    const baris = await this.db.kueriSatu<{ PENGAJUAN: number; UNIK: number }>(
      `SELECT COUNT(*) AS pengajuan, COUNT(DISTINCT UPPER(TRIM(pm.pekerjaan))) AS unik
         FROM peminjaman pm
        WHERE pm.pekerjaan IS NOT NULL
          AND TRIM(pm.pekerjaan) IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM proyek p
                           WHERE UPPER(TRIM(p.nama_pekerjaan)) = UPPER(TRIM(pm.pekerjaan)))`,
    );
    return { pengajuan: Number(baris?.PENGAJUAN ?? 0), unik: Number(baris?.UNIK ?? 0) };
  }

  async bidang() {
    return this.db.kueri(
      `SELECT id, nama, dari_migrasi,
              (SELECT COUNT(*) FROM alat a WHERE a.bidang_id = b.id) AS dipakai_alat
         FROM bidang b ORDER BY b.dari_migrasi, b.nama`,
    );
  }

  /** Ringkasan kesiapan data, dipakai halaman master sebagai daftar kerja. */
  async kesiapan() {
    const baris = await this.db.kueriSatu<Record<string, unknown>>(`
      SELECT
        (SELECT COUNT(*) FROM pengguna WHERE duplikat_dari IS NULL AND unit_id IS NULL) AS tanpa_unit,
        (SELECT COUNT(*) FROM pengguna p WHERE p.duplikat_dari IS NULL AND p.unit_id IS NULL
           AND EXISTS (SELECT 1 FROM pengguna_peran r WHERE r.pengguna_id = p.id)) AS tanpa_unit_berperan,
        (SELECT COUNT(*) FROM pengguna WHERE duplikat_dari IS NOT NULL) AS pengguna_ganda,
        (SELECT COUNT(*) FROM referensi WHERE dari_migrasi = 1) AS referensi_migrasi,
        (SELECT COUNT(*) FROM bidang WHERE dari_migrasi = 1) AS bidang_migrasi,
        (SELECT COUNT(*) FROM alat WHERE dihapus_pada IS NULL AND kode_barcode IS NULL) AS alat_tanpa_barcode,
        (SELECT COUNT(*) FROM alat WHERE dihapus_pada IS NULL AND bidang_id IS NULL) AS alat_tanpa_bidang,
        (SELECT COUNT(*) FROM peminjaman WHERE jenis_alur_id IS NULL) AS peminjaman_tanpa_alur,
        (SELECT COUNT(*) FROM lampiran WHERE lokasi IS NULL) AS lampiran_sistem_lama
      FROM dual
    `);
    return {
      penggunaTanpaUnit: Number(baris?.TANPA_UNIT ?? 0),
      penggunaTanpaUnitBerperan: Number(baris?.TANPA_UNIT_BERPERAN ?? 0),
      penggunaGanda: Number(baris?.PENGGUNA_GANDA ?? 0),
      referensiDariMigrasi: Number(baris?.REFERENSI_MIGRASI ?? 0),
      bidangDariMigrasi: Number(baris?.BIDANG_MIGRASI ?? 0),
      alatTanpaBarcode: Number(baris?.ALAT_TANPA_BARCODE ?? 0),
      alatTanpaBidang: Number(baris?.ALAT_TANPA_BIDANG ?? 0),
      peminjamanTanpaAlur: Number(baris?.PEMINJAMAN_TANPA_ALUR ?? 0),
      lampiranSistemLama: Number(baris?.LAMPIRAN_SISTEM_LAMA ?? 0),
    };
  }
}
