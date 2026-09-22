"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LaporanRepository = void 0;
const common_1 = require("@nestjs/common");
const oracle_service_1 = require("../basisdata/oracle.service");
/**
 * Laporan utilitas alat (PRD F13, rumusnya di PRD 8.3.2.1).
 *
 * Menggantikan V_UTILITAS_TOOL_PEMAKAIAN, V_UTILITAS_TOOL_PEMAKAIAN_DET,
 * V_UTILITAS_TOOL_MEMO, dan V_JML_UJI_TOOL. Rumusnya dibawa apa adanya; dua
 * cacat pada view rincian diperbaiki, dan perbaikannya disebut di komentar
 * masing-masing.
 */
let LaporanRepository = class LaporanRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * Efektivitas alat per tahun.
     *
     * Rumus asli: jumlah pengujian setahun dibanding estimasi_pertahun; tahunnya
     * dihitung dari tanggal terima.
     *
     * Satu perubahan disengaja: alat yang belum pernah diterima tetap muncul
     * dengan nilai nol. Pada view lama alat seperti itu hilang sama sekali dari
     * laporan, sehingga alat yang justru paling tidak terpakai tidak terlihat.
     */
    async efektivitas(tahun, unitId) {
        return this.db.kueri(`
      SELECT a.id, a.nama, a.kode_barcode, u.nama AS unit, b.nama AS bidang,
             a.tahun_perolehan, a.nilai_kontrak, a.masa_manfaat,
             a.estimasi_pertahun, a.estimasi_persurat,
             NVL(uji.jumlah, 0) AS jumlah_pemakaian,
             CASE WHEN a.estimasi_pertahun IS NULL THEN 'TIDAK DIUKUR'
                  WHEN a.estimasi_pertahun <= NVL(uji.jumlah, 0) THEN 'EFEKTIF'
                  ELSE 'TIDAK EFEKTIF' END AS efektivitas
        FROM alat a
        LEFT JOIN unit u   ON u.id = a.unit_id
        LEFT JOIN bidang b ON b.id = a.bidang_id
        LEFT JOIN (
          SELECT pa.alat_id, SUM(NVL(pa.jumlah_uji,0)) AS jumlah
            FROM peminjaman_alat pa
           WHERE pa.tanggal_terima IS NOT NULL
             AND EXTRACT(YEAR FROM pa.tanggal_terima) = :tahun
           GROUP BY pa.alat_id
        ) uji ON uji.alat_id = a.id
       WHERE a.dihapus_pada IS NULL
         ${unitId ? 'AND a.unit_id = :unitId' : ''}
       ORDER BY efektivitas, a.nama
      `, unitId ? { tahun, unitId } : { tahun });
    }
    /**
     * Cacah peminjaman per alat per bulan.
     *
     * Penyaring aslinya membuang pengajuan yang masih diproses. Di sini
     * dinyatakan eksplisit sebagai daftar status, bukan rangkaian `<>` yang ikut
     * membuang baris berstatus kosong tanpa disengaja (PRD 8.3.2.1).
     */
    async pemakaianBulanan(tahun, unitId) {
        return this.db.kueri(`
      SELECT a.nama, a.kode_barcode, rk.nama AS kondisi,
             TO_CHAR(pm.tanggal_mulai, 'MM') AS bulan,
             COUNT(*) AS jumlah
        FROM peminjaman pm
        JOIN peminjaman_alat pa ON pa.peminjaman_id = pm.id
        JOIN alat a             ON a.id = pa.alat_id
        LEFT JOIN referensi rk  ON rk.id = a.kondisi_id
       WHERE UPPER(pm.status) NOT IN ('DRAFT','BOOKED','WAPPR SP','WAPPR MGR','APPROVED')
         AND EXTRACT(YEAR FROM pm.tanggal_mulai) = :tahun
         ${unitId ? 'AND a.unit_id = :unitId' : ''}
       GROUP BY a.nama, a.kode_barcode, rk.nama, TO_CHAR(pm.tanggal_mulai, 'MM')
       ORDER BY a.nama, bulan
      `, unitId ? { tahun, unitId } : { tahun });
    }
    /**
     * Rincian riwayat pemakaian satu alat.
     *
     * Dua cacat view lama diperbaiki di sini:
     *
     *   1. Penanda "RUSAK" dulu disambung lewat alat saja, sehingga alat yang
     *      pernah rusak tampil RUSAK pada SELURUH riwayatnya — termasuk
     *      peminjaman bertahun-tahun sebelum kerusakannya terjadi. Sekarang
     *      disambung lewat peminjaman.
     *   2. Peminjam yang tidak ada di data pegawai dulu hilang dari laporan
     *      karena sambungannya inner join. Sekarang tetap muncul dengan nama
     *      apa adanya.
     */
    async rincianPemakaian(alatId) {
        return this.db.kueri(`
      SELECT pm.id AS nomor_peminjaman, pm.pekerjaan,
             TO_CHAR(pm.dibuat_pada, 'YYYY-MM-DD HH24:MI') AS tanggal_pinjam,
             TO_CHAR(pa.tanggal_kembali, 'YYYY-MM-DD HH24:MI') AS tanggal_kembali,
             u.nama AS unit,
             NVL(p.nama, pm.nama_peminjam_historis) AS peminjam,
             p.jabatan,
             pm.status,
             CASE WHEN EXISTS (
               SELECT 1 FROM kerusakan k
                WHERE k.peminjaman_alat_id = pa.id
                   OR (k.peminjaman_id = pm.id AND k.alat_id = pa.alat_id)
             ) THEN 'RUSAK' ELSE 'TIDAK' END AS kerusakan,
             (SELECT ROUND(SUM(kk.bobot * kk.nilai) / 100, 2)
                FROM penilaian_kondisi pk
                JOIN kategori_kondisi kk ON kk.id = pk.kategori_id
               WHERE pk.peminjaman_alat_id = pa.id AND pk.tahap = 'SENT') AS nilai_saat_pinjam,
             (SELECT ROUND(SUM(kk.bobot * kk.nilai) / 100, 2)
                FROM penilaian_kondisi pk
                JOIN kategori_kondisi kk ON kk.id = pk.kategori_id
               WHERE pk.peminjaman_alat_id = pa.id AND pk.tahap = 'RETURN') AS nilai_saat_kembali
        FROM peminjaman_alat pa
        JOIN peminjaman pm     ON pm.id = pa.peminjaman_id
        LEFT JOIN unit u       ON u.id = pm.unit_id
        LEFT JOIN pengguna p   ON p.id = pm.peminjam_id
       WHERE pa.alat_id = :alatId
       ORDER BY pm.dibuat_pada DESC
      `, { alatId });
    }
    /** Agregasi untuk beranda monitoring, menggantikan empat view dashboard. */
    async dashboard(unitId) {
        const syarat = unitId ? 'AND a.unit_id = :unitId' : '';
        const ikatan = unitId ? { unitId } : {};
        const alat = await this.db.kueri(`SELECT u.nama AS unit, b.nama AS bidang, rk.nama AS kondisi, COUNT(*) AS jumlah
         FROM alat a
         LEFT JOIN unit u ON u.id = a.unit_id
         LEFT JOIN bidang b ON b.id = a.bidang_id
         LEFT JOIN referensi rk ON rk.id = a.kondisi_id
        WHERE a.dihapus_pada IS NULL ${syarat}
        GROUP BY u.nama, b.nama, rk.nama
        ORDER BY jumlah DESC`, ikatan);
        const peminjaman = await this.db.kueri(`SELECT pm.status, u.nama AS unit, COUNT(*) AS jumlah
         FROM peminjaman pm
         LEFT JOIN unit u ON u.id = pm.unit_id
        WHERE 1 = 1 ${unitId ? 'AND pm.unit_id = :unitId' : ''}
        GROUP BY pm.status, u.nama
        ORDER BY jumlah DESC`, ikatan);
        return { alat, peminjaman };
    }
};
exports.LaporanRepository = LaporanRepository;
exports.LaporanRepository = LaporanRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [oracle_service_1.OracleService])
], LaporanRepository);
//# sourceMappingURL=laporan.repository.js.map