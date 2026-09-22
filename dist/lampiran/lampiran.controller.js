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
exports.LampiranController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const zod_1 = require("zod");
const lampiran_service_1 = require("./lampiran.service");
const auth_guard_1 = require("../auth/auth.guard");
const berkas_1 = require("./berkas");
const skemaTujuan = zod_1.z.object({
    entitas: zod_1.z.enum(berkas_1.ENTITAS),
    entitasId: zod_1.z.coerce.number().int().positive(),
    jenis: zod_1.z.string().trim().min(1).max(40),
});
let LampiranController = class LampiranController {
    service;
    constructor(service) {
        this.service = service;
    }
    async daftar(kueri) {
        const p = zod_1.z
            .object({
            entitas: zod_1.z.enum(berkas_1.ENTITAS),
            entitasId: zod_1.z.coerce.number().int().positive(),
        })
            .parse(kueri);
        const isi = await this.service.daftar(p.entitas, p.entitasId);
        return { jumlah: isi.length, isi };
    }
    async unggah(permintaan, berkas, kueri) {
        if (!berkas) {
            throw new common_1.BadRequestException({
                code: 'BERKAS_TIDAK_ADA',
                message: 'Sertakan berkas pada bidang bernama "berkas"',
            });
        }
        const hasil = skemaTujuan.safeParse(kueri);
        if (!hasil.success) {
            throw new common_1.BadRequestException({
                code: 'TUJUAN_TIDAK_SAH',
                message: 'Sebutkan entitas, entitasId, dan jenis lampiran',
                details: hasil.error.issues.map((i) => ({
                    field: i.path.join('.'),
                    message: i.message,
                })),
            });
        }
        return this.service.unggah(permintaan.pengguna, hasil.data.entitas, hasil.data.entitasId, hasil.data.jenis.toUpperCase(), berkas);
    }
    async unduh(id, tanggapan) {
        const { lampiran, lokasiPenuh } = await this.service.berkasUntukUnduh(id);
        // Berkas selalu diunduh, tidak pernah dijalankan peramban: yang tersimpan
        // memang hanya gambar dan PDF, tetapi menyatakannya eksplisit menutup
        // kemungkinan berkas dipakai menjalankan skrip di peramban penerima.
        tanggapan.setHeader('Content-Type', lampiran.tipeMedia ?? 'application/octet-stream');
        tanggapan.setHeader('X-Content-Type-Options', 'nosniff');
        tanggapan.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
        tanggapan.download(lokasiPenuh, lampiran.namaBerkas);
    }
    async hapus(permintaan, id) {
        await this.service.hapus(permintaan.pengguna, id);
        return { dihapus: id };
    }
    jadikanUtama(permintaan, id) {
        return this.service.jadikanUtama(permintaan.pengguna, id);
    }
};
exports.LampiranController = LampiranController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], LampiranController.prototype, "daftar", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('berkas')),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], LampiranController.prototype, "unggah", null);
__decorate([
    (0, common_1.Get)(':id/berkas'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], LampiranController.prototype, "unduh", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, auth_guard_1.ButuhPeran)('PENGELOLA', 'STAF', 'ADMIN_UNIT', 'ADMIN_SUPER'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], LampiranController.prototype, "hapus", null);
__decorate([
    (0, common_1.Patch)(':id/utama'),
    (0, auth_guard_1.ButuhPeran)('PENGELOLA', 'ADMIN_UNIT', 'ADMIN_SUPER'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", void 0)
], LampiranController.prototype, "jadikanUtama", null);
exports.LampiranController = LampiranController = __decorate([
    (0, common_1.Controller)('lampiran'),
    __metadata("design:paramtypes", [lampiran_service_1.LampiranService])
], LampiranController);
//# sourceMappingURL=lampiran.controller.js.map