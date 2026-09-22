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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SertifikatRepository = void 0;
const common_1 = require("@nestjs/common");
const oracledb_1 = __importDefault(require("oracledb"));
const oracle_service_1 = require("../basisdata/oracle.service");
const sertifikat_1 = require("./sertifikat");
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
function keSertifikat(b, hariIni) {
    const { status, sisaHari } = (0, sertifikat_1.statusSertifikat)(b.TGL_SARAN, hariIni);
    return {
        id: Number(b.ID),
        alatId: Number(b.ALAT_ID),
        nomor: b.NOMOR,
        tanggalKalibrasi: b.TGL_KALIBRASI,
        tanggalSaran: b.TGL_SARAN,
        hasil: b.HASIL,
        hasilBaku: (0, sertifikat_1.bakukanHasil)(b.HASIL),
        pelaksana: b.PELAKSANA,
        berkas: Number(b.BERKAS ?? 0),
        status,
        sisaHari,
    };
}
/** Hanya ikatan yang benar-benar muncul di SQL yang boleh dikirim ke Oracle. */
function ikatanTerpakai(sql, ikatan) {
    return Object.fromEntries(Object.entries(ikatan).filter(([kunci]) => sql.includes(`:${kunci}`)));
}
let SertifikatRepository = class SertifikatRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * Angka di kepala layar: dihitung dari sertifikat terbaru setiap alat, bukan
     * dari seluruh baris, sebab yang menentukan status alat hanya yang terakhir.
     */
    async ringkasan(hariIni) {
        // Dua kueri: Oracle menolak subkueri skalar di antara fungsi agregat (ORA-00937).
        const [baris, semua] = await Promise.all([
            this.db.kueriSatu(`
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
      `, { hariIni, jeda: sertifikat_1.HARI_SEGERA }),
            this.db.kueriSatu(`SELECT COUNT(*) AS sertifikat FROM alat_sertifikat s
           JOIN alat a ON a.id = s.alat_id AND a.dihapus_pada IS NULL`),
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
    async daftar(filter, hariIni) {
        const ikatan = { hariIni, jeda: sertifikat_1.HARI_SEGERA };
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
        if (filter.status === 'LEWAT')
            syarat.push(`t.tanggal_saran < TO_DATE(:hariIni,'YYYY-MM-DD')`);
        if (filter.status === 'SEGERA')
            syarat.push(`t.tanggal_saran BETWEEN TO_DATE(:hariIni,'YYYY-MM-DD')
                   AND TO_DATE(:hariIni,'YYYY-MM-DD') + :jeda`);
        if (filter.status === 'BERLAKU')
            syarat.push(`t.tanggal_saran > TO_DATE(:hariIni,'YYYY-MM-DD') + :jeda`);
        if (filter.status === 'TANPA_TANGGAL')
            syarat.push('t.tanggal_saran IS NULL');
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
        const jumlah = await this.db.kueriSatu(sqlJumlah, 
        // Oracle menolak ikatan yang tidak dipakai, dan saringan di atas bersifat pilihan.
        ikatanTerpakai(sqlJumlah, ikatan));
        /**
         * Urutan: kedaluwarsa dulu, lalu yang segera habis, lalu yang tanpa tanggal.
         * Inilah urutan kerja petugas, bukan urutan abjad.
         */
        const rows = await this.db.kueri(`
      SELECT * FROM (${dari})
       ORDER BY CASE
                  WHEN tgl_saran IS NULL THEN 2
                  WHEN TO_DATE(tgl_saran,'YYYY-MM-DD') < TO_DATE(:hariIni,'YYYY-MM-DD') THEN 0
                  WHEN TO_DATE(tgl_saran,'YYYY-MM-DD') <= TO_DATE(:hariIni,'YYYY-MM-DD') + :jeda THEN 1
                  ELSE 3 END,
                tgl_saran,
                nama
       OFFSET :lewati ROWS FETCH NEXT :ambil ROWS ONLY
      `, { ...ikatan, lewati: (filter.halaman - 1) * filter.perHalaman, ambil: filter.perHalaman });
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
    async riwayat(alatId, hariIni) {
        const rows = await this.db.kueri(`
      SELECT s.id, s.alat_id, TRIM(s.nomor) AS nomor,
             TO_CHAR(s.tanggal_kalibrasi,'YYYY-MM-DD') AS tgl_kalibrasi,
             TO_CHAR(s.tanggal_saran,'YYYY-MM-DD') AS tgl_saran,
             TRIM(s.hasil) AS hasil, TRIM(s.pelaksana) AS pelaksana,
             ${JUMLAH_BERKAS} AS berkas
        FROM alat_sertifikat s
       WHERE s.alat_id = :alatId
       ORDER BY s.tanggal_kalibrasi DESC NULLS LAST, s.id DESC
      `, { alatId });
        return rows.map((b) => keSertifikat(b, hariIni));
    }
    async satu(id, hariIni) {
        const b = await this.db.kueriSatu(`
      SELECT s.id, s.alat_id, TRIM(s.nomor) AS nomor,
             TO_CHAR(s.tanggal_kalibrasi,'YYYY-MM-DD') AS tgl_kalibrasi,
             TO_CHAR(s.tanggal_saran,'YYYY-MM-DD') AS tgl_saran,
             TRIM(s.hasil) AS hasil, TRIM(s.pelaksana) AS pelaksana,
             ${JUMLAH_BERKAS} AS berkas
        FROM alat_sertifikat s
       WHERE s.id = :id
      `, { id });
        return b ? keSertifikat(b, hariIni) : undefined;
    }
    async alatAda(alatId) {
        const b = await this.db.kueriSatu('SELECT 1 AS ada FROM alat WHERE id = :alatId AND dihapus_pada IS NULL', { alatId });
        return !!b;
    }
    /** Daftar nama pelaksana untuk saringan dan saran isian. */
    async pelaksana() {
        const rows = await this.db.kueri(`SELECT TRIM(pelaksana) AS nama, COUNT(*) AS jumlah
         FROM alat_sertifikat
        WHERE pelaksana IS NOT NULL AND TRIM(pelaksana) IS NOT NULL
        GROUP BY TRIM(pelaksana)
        ORDER BY TRIM(pelaksana)`);
        return rows.map((r) => ({ nama: r.NAMA, jumlah: Number(r.JUMLAH) }));
    }
    async tambah(alatId, isi, oleh) {
        return this.db.transaksi(async (koneksi) => {
            const hasil = await koneksi.execute(`
        INSERT INTO alat_sertifikat (
          alat_id, nomor, tanggal_kalibrasi, tanggal_saran, hasil, pelaksana, id_lama)
        VALUES (:alatId, :nomor, TO_DATE(:kalibrasi,'YYYY-MM-DD'),
                CASE WHEN :saran IS NULL THEN NULL ELSE TO_DATE(:saran,'YYYY-MM-DD') END,
                :hasil, :pelaksana, NULL)
        RETURNING id INTO :id
        `, {
                alatId,
                nomor: isi.nomor.trim(),
                kalibrasi: isi.tanggalKalibrasi,
                saran: isi.tanggalSaran,
                hasil: isi.hasil,
                pelaksana: isi.pelaksana,
                id: { dir: oracledb_1.default.BIND_OUT, type: oracledb_1.default.NUMBER },
            });
            void oleh; // pencatat perubahan master data belum ada tabelnya (PRD §9.4)
            return Number(hasil.outBinds?.id?.[0]);
        });
    }
    async ubah(id, isi) {
        await this.db.transaksi(async (koneksi) => {
            await koneksi.execute(`
        UPDATE alat_sertifikat
           SET nomor = :nomor,
               tanggal_kalibrasi = TO_DATE(:kalibrasi,'YYYY-MM-DD'),
               tanggal_saran = CASE WHEN :saran IS NULL THEN NULL ELSE TO_DATE(:saran,'YYYY-MM-DD') END,
               hasil = :hasil,
               pelaksana = :pelaksana
         WHERE id = :id
        `, {
                id,
                nomor: isi.nomor.trim(),
                kalibrasi: isi.tanggalKalibrasi,
                saran: isi.tanggalSaran,
                hasil: isi.hasil,
                pelaksana: isi.pelaksana,
            });
        });
    }
};
exports.SertifikatRepository = SertifikatRepository;
exports.SertifikatRepository = SertifikatRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [oracle_service_1.OracleService])
], SertifikatRepository);
//# sourceMappingURL=sertifikat.repository.js.map