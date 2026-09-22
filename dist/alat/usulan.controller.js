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
exports.UsulanController = void 0;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const usulan_service_1 = require("./usulan.service");
const auth_guard_1 = require("../auth/auth.guard");
const skemaUsulan = zod_1.z.object({
    tindakan: zod_1.z.enum(['UBAH', 'HAPUS']),
    isi: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).default({}),
    keterangan: zod_1.z.string().trim().max(2000).optional().nullable(),
});
const skemaKeputusan = zod_1.z.object({
    keputusan: zod_1.z.enum(['SETUJU', 'TOLAK']),
    alasan: zod_1.z.string().trim().max(2000).optional().nullable(),
});
function uraikan(skema, nilai) {
    const hasil = skema.safeParse(nilai);
    if (!hasil.success) {
        throw new common_1.BadRequestException({
            code: 'PERMINTAAN_TIDAK_SAH',
            message: 'Isian tidak lengkap',
            details: hasil.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        });
    }
    return hasil.data;
}
/**
 * Master data alat (PRD F13).
 *
 * Rutenya diletakkan di bawah /alat-master agar tidak bertabrakan dengan
 * katalog peminjaman di /alat, yang dipakai seluruh pengguna.
 */
let UsulanController = class UsulanController {
    service;
    constructor(service) {
        this.service = service;
    }
    tambah(permintaan, badan) {
        return this.service.tambah(permintaan.pengguna, uraikan(zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()), badan));
    }
    usulkan(id, permintaan, badan) {
        const p = uraikan(skemaUsulan, badan);
        return this.service.usulkan(permintaan.pengguna, id, p.tindakan, p.isi, p.keterangan ?? null);
    }
    riwayat(id) {
        return this.service.riwayat(id);
    }
    async menunggu() {
        const isi = await this.service.menunggu();
        return { jumlah: isi.length, isi };
    }
    putuskan(id, permintaan, badan) {
        const p = uraikan(skemaKeputusan, badan);
        return this.service.putuskan(permintaan.pengguna, id, p.keputusan, p.alasan ?? null);
    }
};
exports.UsulanController = UsulanController;
__decorate([
    (0, common_1.Post)(),
    (0, auth_guard_1.ButuhPeran)('PENGELOLA', 'ADMIN_UNIT', 'ADMIN_SUPER'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], UsulanController.prototype, "tambah", null);
__decorate([
    (0, common_1.Post)(':id/usulan'),
    (0, auth_guard_1.ButuhPeran)('PENGELOLA', 'ADMIN_UNIT', 'ADMIN_SUPER'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], UsulanController.prototype, "usulkan", null);
__decorate([
    (0, common_1.Get)(':id/riwayat'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], UsulanController.prototype, "riwayat", null);
__decorate([
    (0, common_1.Get)('usulan/menunggu'),
    (0, auth_guard_1.ButuhPeran)('ADMIN_SUPER'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], UsulanController.prototype, "menunggu", null);
__decorate([
    (0, common_1.Post)('usulan/:id/keputusan'),
    (0, auth_guard_1.ButuhPeran)('ADMIN_SUPER'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], UsulanController.prototype, "putuskan", null);
exports.UsulanController = UsulanController = __decorate([
    (0, common_1.Controller)('alat-master'),
    __metadata("design:paramtypes", [usulan_service_1.UsulanService])
], UsulanController);
//# sourceMappingURL=usulan.controller.js.map