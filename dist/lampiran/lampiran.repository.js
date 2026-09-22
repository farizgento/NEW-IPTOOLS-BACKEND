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
exports.LampiranRepository = exports.sqlFotoUtama = void 0;
const common_1 = require("@nestjs/common");
const oracledb_1 = __importDefault(require("oracledb"));
const oracle_service_1 = require("../basisdata/oracle.service");
/**
 * Kolom SQL: id foto utama sebuah alat — foto berurutan terkecil yang berkasnya
 * benar-benar tersimpan. Foto hasil migrasi yang fisiknya belum dipindahkan
 * dilewati, supaya katalog tidak menampilkan gambar rusak.
 */
const sqlFotoUtama = (kolomAlatId) => `(
  SELECT MIN(f.id) KEEP (DENSE_RANK FIRST ORDER BY f.urutan, f.id)
    FROM lampiran f
   WHERE f.entitas = 'ALAT' AND f.entitas_id = ${kolomAlatId} AND f.jenis = 'GAMBAR'
     AND f.lokasi IS NOT NULL AND f.berkas_hilang = 0)`;
exports.sqlFotoUtama = sqlFotoUtama;
let LampiranRepository = class LampiranRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    ke(r) {
        return {
            id: Number(r.ID),
            entitas: r.ENTITAS,
            entitasId: Number(r.ENTITAS_ID),
            jenis: r.JENIS,
            namaBerkas: r.NAMA_BERKAS,
            lokasi: r.LOKASI ?? null,
            tipeMedia: r.TIPE_MEDIA ?? null,
            ukuranBita: r.UKURAN_BITA === null ? null : Number(r.UKURAN_BITA),
            berkasHilang: Number(r.BERKAS_HILANG ?? 0) === 1,
            diunggahOleh: r.DIUNGGAH_OLEH === null ? null : Number(r.DIUNGGAH_OLEH),
            dibuatPada: r.DIBUAT_PADA ? String(r.DIBUAT_PADA) : null,
        };
    }
    PILIH = `
    SELECT id, entitas, entitas_id, jenis, nama_berkas, lokasi, tipe_media,
           ukuran_bita, berkas_hilang, diunggah_oleh,
           TO_CHAR(dibuat_pada, 'YYYY-MM-DD HH24:MI') AS dibuat_pada
      FROM lampiran
  `;
    async daftar(entitas, entitasId) {
        const baris = await this.db.kueri(`${this.PILIH} WHERE entitas = :entitas AND entitas_id = :entitasId
        ORDER BY urutan, id`, { entitas, entitasId });
        return baris.map((r) => this.ke(r));
    }
    async ambil(id) {
        const baris = await this.db.kueriSatu(`${this.PILIH} WHERE id = :id`, { id });
        return baris ? this.ke(baris) : undefined;
    }
    async simpan(masukan) {
        return this.db.transaksi(async (koneksi) => {
            const hasil = await koneksi.execute(`
        INSERT INTO lampiran (entitas, entitas_id, jenis, nama_berkas, lokasi,
                              tipe_media, ukuran_bita, diunggah_oleh, urutan)
        VALUES (:entitas, :entitasId, :jenis, :namaBerkas, :lokasi,
                :tipeMedia, :ukuranBita, :diunggahOleh,
                (SELECT NVL(MAX(urutan), 0) + 1 FROM lampiran
                  WHERE entitas = :entitas AND entitas_id = :entitasId AND jenis = :jenis))
        RETURNING id INTO :id
        `, {
                ...masukan,
                id: { dir: oracledb_1.default.BIND_OUT, type: oracledb_1.default.NUMBER },
            });
            return Number(hasil.outBinds?.id?.[0]);
        });
    }
    async hapus(id) {
        await this.db.transaksi(async (koneksi) => {
            await koneksi.execute('DELETE FROM lampiran WHERE id = :id', { id });
        });
    }
    /** Apakah baris tujuan lampiran ada. Hanya entitas master data yang diperiksa. */
    async entitasAda(entitas, entitasId) {
        const sql = entitas === 'ALAT'
            ? 'SELECT 1 AS ada FROM alat WHERE id = :id AND dihapus_pada IS NULL'
            : entitas === 'ALAT_SERTIFIKAT'
                ? 'SELECT 1 AS ada FROM alat_sertifikat WHERE id = :id'
                : null;
        if (!sql)
            return true;
        return !!(await this.db.kueriSatu(sql, { id: entitasId }));
    }
    /** Menaruh lampiran di urutan pertama di antara lampiran sejenis pada entitas yang sama. */
    async jadikanPertama(id) {
        await this.db.transaksi(async (koneksi) => {
            await koneksi.execute(`UPDATE lampiran l SET urutan = (
           SELECT NVL(MIN(x.urutan), 0) - 1 FROM lampiran x
            WHERE x.entitas = l.entitas AND x.entitas_id = l.entitas_id AND x.jenis = l.jenis)
          WHERE l.id = :id`, { id });
        });
    }
    /** Menandai berkas yang barisnya ada tetapi fisiknya tidak ditemukan. */
    async tandaiHilang(id) {
        await this.db.transaksi(async (koneksi) => {
            await koneksi.execute('UPDATE lampiran SET berkas_hilang = 1 WHERE id = :id', { id });
        });
    }
};
exports.LampiranRepository = LampiranRepository;
exports.LampiranRepository = LampiranRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [oracle_service_1.OracleService])
], LampiranRepository);
//# sourceMappingURL=lampiran.repository.js.map