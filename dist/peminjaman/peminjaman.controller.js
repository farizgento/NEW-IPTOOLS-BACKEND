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
exports.PeminjamanController = void 0;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const peminjaman_service_1 = require("./peminjaman.service");
const peminjaman_repository_1 = require("./peminjaman.repository");
const skemaCheckout = zod_1.z.object({
    pekerjaan: zod_1.z.string().trim().min(1),
    nomorWo: zod_1.z.string().trim().min(1),
    tanggalMulai: zod_1.z.string().trim(),
    tanggalSelesai: zod_1.z.string().trim(),
    tujuan: zod_1.z.string().trim().optional().nullable(),
    kontak: zod_1.z.string().trim().optional().nullable(),
    ambilDiGudang: zod_1.z.boolean().optional(),
    abaikanDugaanKembar: zod_1.z.boolean().optional(),
});
let PeminjamanController = class PeminjamanController {
    service;
    repo;
    constructor(service, repo) {
        this.service = service;
        this.repo = repo;
    }
    /** Ringkasan sebelum tombol kirim: berapa alat, alur apa, siapa penyetujunya. */
    ringkasan(permintaan, ambilDiGudang) {
        return this.service.ringkasan(permintaan.pengguna, ambilDiGudang === 'true');
    }
    milikSaya(permintaan) {
        return this.repo.milikSaya(permintaan.pengguna.id);
    }
    async detail(id) {
        const data = await this.repo.detail(id);
        if (!data)
            throw new common_1.NotFoundException(`Pengajuan #${id} tidak ditemukan`);
        return data;
    }
    async checkout(permintaan, badan) {
        const hasil = skemaCheckout.safeParse(badan);
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
        return this.service.checkout(permintaan.pengguna, {
            ...hasil.data,
            tujuan: hasil.data.tujuan ?? null,
            kontak: hasil.data.kontak ?? null,
        });
    }
};
exports.PeminjamanController = PeminjamanController;
__decorate([
    (0, common_1.Get)('ringkasan'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('ambilDiGudang')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PeminjamanController.prototype, "ringkasan", null);
__decorate([
    (0, common_1.Get)('saya'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PeminjamanController.prototype, "milikSaya", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], PeminjamanController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PeminjamanController.prototype, "checkout", null);
exports.PeminjamanController = PeminjamanController = __decorate([
    (0, common_1.Controller)('peminjaman'),
    __metadata("design:paramtypes", [peminjaman_service_1.PeminjamanService,
        peminjaman_repository_1.PeminjamanRepository])
], PeminjamanController);
//# sourceMappingURL=peminjaman.controller.js.map