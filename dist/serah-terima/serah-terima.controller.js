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
exports.SerahTerimaController = void 0;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const serah_terima_service_1 = require("./serah-terima.service");
const auth_guard_1 = require("../auth/auth.guard");
const skemaSiapkan = zod_1.z.object({
    peminjamanId: zod_1.z.coerce.number().int().positive(),
    arah: zod_1.z.enum(['KIRIM', 'KEMBALI']).default('KIRIM'),
    ringkas: zod_1.z.boolean().optional(),
    peminjamanAlatIds: zod_1.z.array(zod_1.z.coerce.number().int().positive()).min(1),
    nomorKendaraan: zod_1.z.string().trim().optional().nullable(),
    jenisKendaraan: zod_1.z.string().trim().optional().nullable(),
    pengemudi: zod_1.z.string().trim().optional().nullable(),
});
const skemaKonfirmasi = zod_1.z.object({
    metode: zod_1.z.enum(['TAUTAN', 'KODE', 'TANDA_TANGAN', 'PETUGAS', 'PINDAI']),
    serahTerimaAlatIds: zod_1.z.array(zod_1.z.coerce.number().int().positive()).optional(),
    kode: zod_1.z.string().trim().optional().nullable(),
    alasan: zod_1.z.string().trim().optional().nullable(),
    tautan: zod_1.z.string().trim().optional().nullable(),
    belumDiterima: zod_1.z
        .array(zod_1.z.object({ serahTerimaAlatId: zod_1.z.coerce.number().int().positive(), alasan: zod_1.z.string().trim().min(3).max(500) }))
        .optional(),
});
const skemaKonfirmasiTautan = skemaKonfirmasi.pick({ serahTerimaAlatIds: true, belumDiterima: true });
function uraikan(skema, badan) {
    const hasil = skema.safeParse(badan);
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
    return hasil.data;
}
let SerahTerimaController = class SerahTerimaController {
    service;
    constructor(service) {
        this.service = service;
    }
    /** F9 — daftar yang menunggu konfirmasi saya. */
    menunggu(permintaan) {
        return this.service.menungguKonfirmasi(permintaan.pengguna);
    }
    /** Daftar kerja petugas gudang (F7 + F12). */
    antrean(permintaan) {
        return this.service.antreanPetugas(permintaan.pengguna);
    }
    /** Bahan layar penyiapan satu pengajuan (F7). */
    persiapan(peminjamanId, permintaan) {
        return this.service.persiapan(peminjamanId, permintaan.pengguna);
    }
    /**
     * F8 jalur 1 — halaman tautan tanpa login.
     *
     * Satu-satunya pintu masuk tanpa sesi. Yang dapat dilihat dan dikonfirmasi
     * hanya serah terima yang tertulis di tautan bertanda tangan itu.
     */
    berkasTautan(token) {
        return this.service.berkasTautan(token);
    }
    konfirmasiTautan(token, badan) {
        const p = uraikan(skemaKonfirmasiTautan, badan);
        return this.service.konfirmasiTautan(token, {
            ...(p.serahTerimaAlatIds ? { serahTerimaAlatIds: p.serahTerimaAlatIds } : {}),
            ...(p.belumDiterima ? { belumDiterima: p.belumDiterima } : {}),
        });
    }
    /** F7 — menyiapkan dokumen serah terima. */
    siapkan(permintaan, badan) {
        const p = uraikan(skemaSiapkan, badan);
        return this.service.siapkan(permintaan.pengguna, {
            peminjamanId: p.peminjamanId,
            arah: p.arah,
            ringkas: p.ringkas ?? false,
            peminjamanAlatIds: p.peminjamanAlatIds,
            nomorKendaraan: p.nomorKendaraan ?? null,
            jenisKendaraan: p.jenisKendaraan ?? null,
            pengemudi: p.pengemudi ?? null,
        });
    }
    berkas(id, permintaan) {
        return this.service.berkas(id, permintaan.pengguna);
    }
    /** F7 — menyerahkan alat, status menjadi SENT. */
    serahkan(id, permintaan) {
        return this.service.serahkan(permintaan.pengguna, id);
    }
    /** F8 + F9 — konfirmasi penerimaan lewat salah satu dari empat jalur. */
    konfirmasi(id, permintaan, badan) {
        const p = uraikan(skemaKonfirmasi, badan);
        return this.service.konfirmasi(id, permintaan.pengguna, {
            metode: p.metode,
            ...(p.serahTerimaAlatIds ? { serahTerimaAlatIds: p.serahTerimaAlatIds } : {}),
            kode: p.kode ?? null,
            alasan: p.alasan ?? null,
            tautan: p.tautan ?? null,
            ...(p.belumDiterima ? { belumDiterima: p.belumDiterima } : {}),
        });
    }
};
exports.SerahTerimaController = SerahTerimaController;
__decorate([
    (0, common_1.Get)('menunggu-saya'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SerahTerimaController.prototype, "menunggu", null);
__decorate([
    (0, common_1.Get)('antrean'),
    (0, auth_guard_1.ButuhPeran)('PENGELOLA', 'STAF'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SerahTerimaController.prototype, "antrean", null);
__decorate([
    (0, common_1.Get)('persiapan/:peminjamanId'),
    (0, auth_guard_1.ButuhPeran)('PENGELOLA', 'STAF'),
    __param(0, (0, common_1.Param)('peminjamanId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], SerahTerimaController.prototype, "persiapan", null);
__decorate([
    (0, auth_guard_1.Publik)(),
    (0, common_1.Get)('tautan/:token'),
    __param(0, (0, common_1.Param)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SerahTerimaController.prototype, "berkasTautan", null);
__decorate([
    (0, auth_guard_1.Publik)(),
    (0, common_1.Post)('tautan/:token/konfirmasi'),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SerahTerimaController.prototype, "konfirmasiTautan", null);
__decorate([
    (0, common_1.Post)(),
    (0, auth_guard_1.ButuhPeran)('PENGELOLA', 'STAF'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SerahTerimaController.prototype, "siapkan", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], SerahTerimaController.prototype, "berkas", null);
__decorate([
    (0, common_1.Post)(':id/serahkan'),
    (0, auth_guard_1.ButuhPeran)('PENGELOLA', 'STAF'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], SerahTerimaController.prototype, "serahkan", null);
__decorate([
    (0, common_1.Post)(':id/konfirmasi'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], SerahTerimaController.prototype, "konfirmasi", null);
exports.SerahTerimaController = SerahTerimaController = __decorate([
    (0, common_1.Controller)('serah-terima'),
    __metadata("design:paramtypes", [serah_terima_service_1.SerahTerimaService])
], SerahTerimaController);
//# sourceMappingURL=serah-terima.controller.js.map