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
exports.ApprovalController = void 0;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const approval_service_1 = require("./approval.service");
const auth_guard_1 = require("../auth/auth.guard");
const skemaKeputusan = zod_1.z.object({
    keputusan: zod_1.z.enum(['SETUJU', 'TOLAK']),
    alasan: zod_1.z.string().trim().optional().nullable(),
});
let ApprovalController = class ApprovalController {
    service;
    constructor(service) {
        this.service = service;
    }
    /**
     * Inbox "Tugas Saya" (PRD F4).
     *
     * Satu alamat untuk Pengelola, Manajer, dan GM. Yang membedakan isinya hanya
     * peran dan unit pengguna — bukan halaman yang ia buka.
     */
    antrean(permintaan) {
        return this.service.antrean(permintaan.pengguna);
    }
    /** Layar keputusan (PRD F5). */
    berkas(id, permintaan) {
        return this.service.berkas(id, permintaan.pengguna);
    }
    async putuskan(id, permintaan, badan) {
        const hasil = skemaKeputusan.safeParse(badan);
        if (!hasil.success) {
            throw new common_1.BadRequestException({
                code: 'PERMINTAAN_TIDAK_SAH',
                message: 'Keputusan harus SETUJU atau TOLAK',
                details: hasil.error.issues.map((i) => ({
                    field: i.path.join('.'),
                    message: i.message,
                })),
            });
        }
        return this.service.putuskan(id, permintaan.pengguna, hasil.data.keputusan, hasil.data.alasan ?? null);
    }
};
exports.ApprovalController = ApprovalController;
__decorate([
    (0, common_1.Get)('tugas'),
    (0, auth_guard_1.ButuhPeran)('PENGELOLA', 'MANAJER', 'GM'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ApprovalController.prototype, "antrean", null);
__decorate([
    (0, common_1.Get)('peminjaman/:id/approval'),
    (0, auth_guard_1.ButuhPeran)('PENGELOLA', 'MANAJER', 'GM'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], ApprovalController.prototype, "berkas", null);
__decorate([
    (0, common_1.Post)('peminjaman/:id/approval'),
    (0, auth_guard_1.ButuhPeran)('PENGELOLA', 'MANAJER', 'GM'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", Promise)
], ApprovalController.prototype, "putuskan", null);
exports.ApprovalController = ApprovalController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [approval_service_1.ApprovalService])
], ApprovalController);
//# sourceMappingURL=approval.controller.js.map