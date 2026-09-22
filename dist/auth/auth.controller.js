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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const auth_service_1 = require("./auth.service");
const auth_guard_1 = require("./auth.guard");
const skemaMasuk = zod_1.z.object({
    username: zod_1.z.string().min(1, 'username wajib diisi'),
    sandi: zod_1.z.string().default(''),
});
let AuthController = class AuthController {
    auth;
    constructor(auth) {
        this.auth = auth;
    }
    async masuk(badan) {
        const hasil = skemaMasuk.safeParse(badan);
        if (!hasil.success) {
            throw new common_1.BadRequestException({
                code: 'PERMINTAAN_TIDAK_SAH',
                message: 'Isian tidak lengkap',
                details: hasil.error.issues.map((i) => ({
                    field: i.path.join('.'),
                    message: i.message,
                })),
            });
        }
        const { token, umurDetik, pengguna } = await this.auth.masuk(hasil.data.username, hasil.data.sandi);
        return {
            token,
            umurDetik,
            pengguna: {
                id: pengguna.id,
                nama: pengguna.nama,
                email: pengguna.email,
                unitId: pengguna.unitId,
                namaUnit: pengguna.namaUnit,
                jabatan: pengguna.jabatan,
                peran: pengguna.peran,
                // Ditampilkan apa adanya supaya antarmuka dapat meminta pengguna
                // melengkapi unitnya sendiri saat masih kosong (PRD 6.2.1).
                sumberUnit: pengguna.sumberUnit,
            },
        };
    }
    /** Profil pemegang token. Menjadi cara termudah memastikan token dipakai. */
    saya(permintaan) {
        const p = permintaan.pengguna;
        return {
            id: p.id,
            nama: p.nama,
            email: p.email,
            username: p.username,
            nipeg: p.nipeg,
            unitId: p.unitId,
            namaUnit: p.namaUnit,
            jabatan: p.jabatan,
            sumberUnit: p.sumberUnit,
            peran: p.peran,
        };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, auth_guard_1.Publik)(),
    (0, common_1.Post)('masuk'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "masuk", null);
__decorate([
    (0, common_1.Get)('saya'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "saya", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map