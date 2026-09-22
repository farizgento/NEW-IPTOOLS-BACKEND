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
exports.AlatController = void 0;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const alat_repository_1 = require("./alat.repository");
const skemaKatalog = zod_1.z.object({
    kelompok: zod_1.z.enum(['true', 'false']).optional().transform(v => v === 'true'),
    urut: zod_1.z.enum(['nama', 'tersedia']).default('nama'),
    cari: zod_1.z.string().trim().optional(),
    unitId: zod_1.z.coerce.number().int().positive().optional(),
    bidangId: zod_1.z.coerce.number().int().positive().optional(),
    hanyaTersedia: zod_1.z
        .enum(['true', 'false'])
        .optional()
        .transform((v) => v === 'true'),
    halaman: zod_1.z.coerce.number().int().min(1).default(1),
    perHalaman: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
let AlatController = class AlatController {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    async katalog(kueri) {
        const p = skemaKatalog.parse(kueri);
        return this.repo.katalog({
            kelompok: p.kelompok,
            urut: p.urut,
            cari: p.cari,
            unitId: p.unitId,
            bidangId: p.bidangId,
            hanyaTersedia: p.hanyaTersedia,
            halaman: p.halaman,
            perHalaman: p.perHalaman,
        });
    }
    /** Detail satu alat beserta aksesoris, berkas, dan sertifikat terakhirnya. */
    async detail(id) {
        const data = await this.repo.detail(id);
        if (!data)
            throw new common_1.NotFoundException({ code: 'ALAT_TIDAK_ADA', message: 'Alat tidak ditemukan' });
        return data;
    }
};
exports.AlatController = AlatController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AlatController.prototype, "katalog", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], AlatController.prototype, "detail", null);
exports.AlatController = AlatController = __decorate([
    (0, common_1.Controller)('alat'),
    __metadata("design:paramtypes", [alat_repository_1.AlatRepository])
], AlatController);
//# sourceMappingURL=alat.controller.js.map