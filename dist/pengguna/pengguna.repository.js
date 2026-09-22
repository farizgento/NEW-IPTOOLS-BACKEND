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
exports.PenggunaRepository = void 0;
const common_1 = require("@nestjs/common");
const oracle_service_1 = require("../basisdata/oracle.service");
const pengguna_model_1 = require("./pengguna.model");
const PILIH = `
  SELECT p.id                AS id,
         p.nama              AS nama,
         p.email             AS email,
         p.username          AS username,
         p.nipeg             AS nipeg,
         p.unit_id           AS unit_id,
         u.nama              AS nama_unit,
         p.jabatan           AS jabatan,
         p.sumber_unit       AS sumber_unit,
         p.duplikat_dari     AS duplikat_dari,
         p.nonaktif_pada     AS nonaktif_pada,
         (SELECT LISTAGG(r.peran, ',') WITHIN GROUP (ORDER BY r.peran)
            FROM pengguna_peran r
           WHERE r.pengguna_id = p.id) AS peran
    FROM pengguna p
    LEFT JOIN unit u ON u.id = p.unit_id
`;
let PenggunaRepository = class PenggunaRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async cariLewatUsername(username) {
        const baris = await this.db.kueriSatu(`${PILIH} WHERE LOWER(p.username) = LOWER(:username) AND p.duplikat_dari IS NULL`, { username });
        return baris ? (0, pengguna_model_1.kePengguna)(baris) : undefined;
    }
    async cariLewatEmail(email) {
        const baris = await this.db.kueriSatu(`${PILIH} WHERE LOWER(p.email) = LOWER(:email) AND p.duplikat_dari IS NULL`, { email });
        return baris ? (0, pengguna_model_1.kePengguna)(baris) : undefined;
    }
    async cariLewatId(id) {
        const baris = await this.db.kueriSatu(`${PILIH} WHERE p.id = :id`, { id });
        return baris ? (0, pengguna_model_1.kePengguna)(baris) : undefined;
    }
    async catatLogin(id) {
        await this.db.transaksi(async (koneksi) => {
            await koneksi.execute('UPDATE pengguna SET login_terakhir = SYSTIMESTAMP WHERE id = :id', { id });
        });
    }
    /**
     * Ringkasan kesiapan data pengguna — dipakai layar "Pengguna tanpa unit"
     * (PRD 6.2.1) dan pemeriksaan kesehatan.
     */
    async ringkasan() {
        const baris = await this.db.kueriSatu(`
      SELECT
        COUNT(CASE WHEN duplikat_dari IS NULL THEN 1 END) AS aktif,
        COUNT(CASE WHEN duplikat_dari IS NOT NULL THEN 1 END) AS ganda,
        COUNT(CASE WHEN duplikat_dari IS NULL AND unit_id IS NULL THEN 1 END) AS tanpa_unit,
        COUNT(CASE WHEN duplikat_dari IS NULL AND unit_id IS NULL
                    AND EXISTS (SELECT 1 FROM pengguna_peran r WHERE r.pengguna_id = p.id)
                   THEN 1 END) AS tanpa_unit_berperan
      FROM pengguna p
    `);
        return {
            aktif: Number(baris?.AKTIF ?? 0),
            ganda: Number(baris?.GANDA ?? 0),
            tanpaUnit: Number(baris?.TANPA_UNIT ?? 0),
            tanpaUnitBerperan: Number(baris?.TANPA_UNIT_BERPERAN ?? 0),
        };
    }
};
exports.PenggunaRepository = PenggunaRepository;
exports.PenggunaRepository = PenggunaRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [oracle_service_1.OracleService])
], PenggunaRepository);
//# sourceMappingURL=pengguna.repository.js.map