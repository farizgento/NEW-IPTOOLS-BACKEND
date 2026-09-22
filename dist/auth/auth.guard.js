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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthGuard = exports.ButuhPeran = exports.PERAN_DIMINTA = exports.Publik = exports.TANPA_TOKEN = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const konfigurasi_1 = require("../konfigurasi/konfigurasi");
const pengguna_repository_1 = require("../pengguna/pengguna.repository");
const pengguna_model_1 = require("../pengguna/pengguna.model");
const token_1 = require("./token");
/** Menandai endpoint yang boleh diakses tanpa token. */
exports.TANPA_TOKEN = 'tanpa_token';
const Publik = () => (0, common_1.SetMetadata)(exports.TANPA_TOKEN, true);
exports.Publik = Publik;
/** Membatasi endpoint pada pemegang salah satu peran. */
exports.PERAN_DIMINTA = 'peran_diminta';
const ButuhPeran = (...peran) => (0, common_1.SetMetadata)(exports.PERAN_DIMINTA, peran);
exports.ButuhPeran = ButuhPeran;
/**
 * Penjaga bawaan seluruh aplikasi: tertutup kecuali ditandai Publik (PRD 5.4).
 *
 * Peran dibaca ulang dari basis data pada setiap permintaan, bukan dipercaya
 * apa adanya dari token. Dengan begitu pencabutan peran langsung berlaku, dan
 * peran tidak bisa dipalsukan lewat cookie seperti pada sistem lama.
 */
let AuthGuard = class AuthGuard {
    reflector;
    pengguna;
    konf;
    constructor(reflector, pengguna, konf) {
        this.reflector = reflector;
        this.pengguna = pengguna;
        this.konf = konf;
    }
    async canActivate(konteks) {
        const publik = this.reflector.getAllAndOverride(exports.TANPA_TOKEN, [
            konteks.getHandler(),
            konteks.getClass(),
        ]);
        if (publik)
            return true;
        const permintaan = konteks.switchToHttp().getRequest();
        const token = (0, token_1.ambilTokenDariHeader)(permintaan.headers.authorization);
        if (!token)
            throw new common_1.UnauthorizedException('Token tidak disertakan');
        const hasil = (0, token_1.verifikasiToken)(token, this.konf.JWT_RAHASIA);
        if (!hasil.sah || !hasil.isi) {
            throw new common_1.UnauthorizedException(`Token ditolak: ${hasil.alasan ?? 'tidak sah'}`);
        }
        const pengguna = await this.pengguna.cariLewatId(hasil.isi.sub);
        if (!pengguna)
            throw new common_1.UnauthorizedException('Pengguna tidak ditemukan');
        if (!pengguna.aktif)
            throw new common_1.UnauthorizedException('Akun tidak aktif');
        permintaan.pengguna = pengguna;
        const diminta = this.reflector.getAllAndOverride(exports.PERAN_DIMINTA, [
            konteks.getHandler(),
            konteks.getClass(),
        ]);
        if (diminta?.length && !(0, pengguna_model_1.punyaSalahSatuPeran)(pengguna, diminta)) {
            throw new common_1.ForbiddenException(`Tindakan ini menuntut peran: ${diminta.join(', ')}`);
        }
        return true;
    }
};
exports.AuthGuard = AuthGuard;
exports.AuthGuard = AuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(konfigurasi_1.KONFIGURASI)),
    __metadata("design:paramtypes", [core_1.Reflector,
        pengguna_repository_1.PenggunaRepository, Object])
], AuthGuard);
//# sourceMappingURL=auth.guard.js.map