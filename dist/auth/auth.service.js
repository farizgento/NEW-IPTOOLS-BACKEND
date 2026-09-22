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
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const konfigurasi_1 = require("../konfigurasi/konfigurasi");
const pengguna_repository_1 = require("../pengguna/pengguna.repository");
const pengguna_model_1 = require("../pengguna/pengguna.model");
const identitas_1 = require("./identitas");
const token_1 = require("./token");
let AuthService = AuthService_1 = class AuthService {
    repo;
    identitas;
    konf;
    log = new common_1.Logger(AuthService_1.name);
    constructor(repo, identitas, konf) {
        this.repo = repo;
        this.identitas = identitas;
        this.konf = konf;
    }
    async masuk(username, sandi) {
        const sah = await this.identitas.periksa(username, sandi);
        if (!sah)
            throw new common_1.UnauthorizedException('Username atau sandi salah');
        // Username adalah kunci utama pencarian; email dipakai sebagai cadangan
        // karena sebagian baris lama tidak punya username (23 dari 611).
        const pengguna = (await this.repo.cariLewatUsername(username)) ?? (await this.repo.cariLewatEmail(username));
        if (!pengguna) {
            // Pesannya sengaja sama dengan sandi salah, agar tidak memberi tahu
            // penyerang username mana yang terdaftar.
            this.log.warn(`Masuk ditolak: "${username}" tidak ada di tabel pengguna`);
            throw new common_1.UnauthorizedException('Username atau sandi salah');
        }
        if (!(0, pengguna_model_1.bolehMasuk)(pengguna)) {
            throw new common_1.UnauthorizedException('Akun tidak aktif');
        }
        await this.repo.catatLogin(pengguna.id);
        const token = (0, token_1.terbitkanToken)({ sub: pengguna.id, peran: pengguna.peran, unitId: pengguna.unitId }, this.konf.JWT_RAHASIA, this.konf.JWT_UMUR_DETIK);
        return { token, umurDetik: this.konf.JWT_UMUR_DETIK, pengguna };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(identitas_1.PENYEDIA_IDENTITAS)),
    __param(2, (0, common_1.Inject)(konfigurasi_1.KONFIGURASI)),
    __metadata("design:paramtypes", [pengguna_repository_1.PenggunaRepository, Object, Object])
], AuthService);
//# sourceMappingURL=auth.service.js.map