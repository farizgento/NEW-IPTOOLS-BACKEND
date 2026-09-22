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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OracleService = void 0;
const common_1 = require("@nestjs/common");
const oracledb_1 = __importDefault(require("oracledb"));
const konfigurasi_1 = require("../konfigurasi/konfigurasi");
/**
 * Satu-satunya pintu ke basis data.
 *
 * SQL ditulis tangan, bukan lewat ORM: skema sudah ditetapkan di db/schema dan
 * tidak boleh diselaraskan otomatis oleh alat apa pun (PRD 5.2).
 */
let OracleService = class OracleService {
    konf;
    pool;
    constructor(konf) {
        this.konf = konf;
    }
    async onModuleInit() {
        // Mode thin: tidak memerlukan Oracle Instant Client terpasang.
        oracledb_1.default.outFormat = oracledb_1.default.OUT_FORMAT_OBJECT;
        oracledb_1.default.fetchAsString = [oracledb_1.default.CLOB];
        this.pool = await oracledb_1.default.createPool({
            user: this.konf.DB_USER,
            password: this.konf.DB_PASSWORD,
            connectString: `${this.konf.DB_HOST}:${this.konf.DB_PORT}/${this.konf.DB_SERVICE}`,
            poolMin: this.konf.DB_POOL_MIN,
            poolMax: this.konf.DB_POOL_MAX,
            poolIncrement: 1,
        });
    }
    async onModuleDestroy() {
        await this.pool?.close(10);
    }
    ambilPool() {
        if (!this.pool)
            throw new Error('Kolam koneksi belum siap');
        return this.pool;
    }
    /** Kueri baca. Selalu memakai bind parameter, tidak pernah merangkai teks SQL. */
    async kueri(sql, ikatan = {}) {
        const koneksi = await this.ambilPool().getConnection();
        try {
            const hasil = await koneksi.execute(sql, ikatan);
            return hasil.rows ?? [];
        }
        finally {
            await koneksi.close();
        }
    }
    async kueriSatu(sql, ikatan = {}) {
        const baris = await this.kueri(sql, ikatan);
        return baris[0];
    }
    /**
     * Menjalankan serangkaian perintah dalam satu transaksi.
     *
     * Satu tindakan bisnis = satu transaksi. Prosedur lama sering COMMIT di
     * tengah jalan lalu gagal sesudahnya, dan itulah asal pengajuan duplikat
     * (PRD 2.5). Di sini commit hanya terjadi bila seluruh isi fungsi selesai.
     */
    async transaksi(kerja) {
        const koneksi = await this.ambilPool().getConnection();
        try {
            const hasil = await kerja(koneksi);
            await koneksi.commit();
            return hasil;
        }
        catch (galat) {
            await koneksi.rollback();
            throw galat;
        }
        finally {
            await koneksi.close();
        }
    }
    /** Dipakai pemeriksaan kesehatan; sengaja sesederhana mungkin. */
    async periksaKoneksi() {
        const baris = await this.kueriSatu('SELECT 1 AS hasil FROM dual');
        return baris?.HASIL === 1;
    }
};
exports.OracleService = OracleService;
exports.OracleService = OracleService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(konfigurasi_1.KONFIGURASI)),
    __metadata("design:paramtypes", [Object])
], OracleService);
//# sourceMappingURL=oracle.service.js.map