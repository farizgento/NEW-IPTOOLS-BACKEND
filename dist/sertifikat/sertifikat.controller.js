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
exports.SertifikatController = void 0;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const sertifikat_repository_1 = require("./sertifikat.repository");
const sertifikat_1 = require("./sertifikat");
const auth_guard_1 = require("../auth/auth.guard");
const STATUS = ['LEWAT', 'SEGERA', 'BERLAKU', 'TANPA_TANGGAL', 'TANPA_BERKAS'];
const skemaDaftar = zod_1.z.object({
    cari: zod_1.z.string().trim().optional(),
    unitId: zod_1.z.coerce.number().int().positive().optional(),
    status: zod_1.z.enum(STATUS).optional(),
    pelaksana: zod_1.z.string().trim().optional(),
    halaman: zod_1.z.coerce.number().int().min(1).default(1),
    perHalaman: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
const skemaIsi = zod_1.z.object({
    nomor: zod_1.z.string().trim().min(1).max(255),
    tanggalKalibrasi: zod_1.z.string().trim(),
    tanggalSaran: zod_1.z.string().trim().nullable().optional(),
    hasil: zod_1.z.string().trim().max(255).nullable().optional(),
    pelaksana: zod_1.z.string().trim().max(255).nullable().optional(),
});
const skemaTambah = skemaIsi.extend({ alatId: zod_1.z.coerce.number().int().positive() });
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
const hariIni = () => new Date().toISOString().slice(0, 10);
/**
 * Sertifikat kalibrasi alat.
 *
 * Membaca boleh oleh siapa saja yang sudah masuk — status kalibrasi menentukan
 * apakah peminjam perlu diberi tahu. Menulis hanya pengelola dan admin.
 */
let SertifikatController = class SertifikatController {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    async daftar(kueri) {
        const p = uraikan(skemaDaftar, kueri);
        const kini = hariIni();
        const [halaman, ringkasan] = await Promise.all([
            this.repo.daftar({
                cari: p.cari,
                unitId: p.unitId,
                status: p.status,
                pelaksana: p.pelaksana,
                halaman: p.halaman,
                perHalaman: p.perHalaman,
            }, kini),
            this.repo.ringkasan(kini),
        ]);
        return { ...halaman, ringkasan };
    }
    pelaksana() {
        return this.repo.pelaksana();
    }
    async riwayat(alatId) {
        if (!(await this.repo.alatAda(alatId)))
            throw new common_1.NotFoundException({ code: 'ALAT_TIDAK_ADA', message: 'Alat tidak ditemukan' });
        return { alatId, isi: await this.repo.riwayat(alatId, hariIni()) };
    }
    async tambah(badan) {
        const p = uraikan(skemaTambah, badan);
        const kini = hariIni();
        if (!(await this.repo.alatAda(p.alatId)))
            throw new common_1.NotFoundException({ code: 'ALAT_TIDAK_ADA', message: 'Alat tidak ditemukan' });
        // Tanggal kalibrasi ulang biasanya setahun setelah kalibrasi; tetap boleh dikosongkan.
        const isi = rapikan(p, p.tanggalSaran === undefined ? (0, sertifikat_1.saranSetahun)(p.tanggalKalibrasi) : p.tanggalSaran ?? null);
        tolakBilaSalah(isi, kini);
        const id = await this.repo.tambah(p.alatId, isi, 0);
        return this.repo.satu(id, kini);
    }
    async ubah(id, badan) {
        const kini = hariIni();
        const lama = await this.repo.satu(id, kini);
        if (!lama)
            throw new common_1.NotFoundException({
                code: 'SERTIFIKAT_TIDAK_ADA',
                message: 'Sertifikat tidak ditemukan',
            });
        const p = uraikan(skemaIsi, badan);
        const isi = rapikan(p, p.tanggalSaran === undefined ? lama.tanggalSaran : p.tanggalSaran ?? null);
        tolakBilaSalah(isi, kini);
        await this.repo.ubah(id, isi);
        return this.repo.satu(id, kini);
    }
};
exports.SertifikatController = SertifikatController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SertifikatController.prototype, "daftar", null);
__decorate([
    (0, common_1.Get)('pelaksana'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SertifikatController.prototype, "pelaksana", null);
__decorate([
    (0, common_1.Get)('alat/:alatId'),
    __param(0, (0, common_1.Param)('alatId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], SertifikatController.prototype, "riwayat", null);
__decorate([
    (0, common_1.Post)(),
    (0, auth_guard_1.ButuhPeran)('PENGELOLA', 'ADMIN_UNIT', 'ADMIN_SUPER'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SertifikatController.prototype, "tambah", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, auth_guard_1.ButuhPeran)('PENGELOLA', 'ADMIN_UNIT', 'ADMIN_SUPER'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], SertifikatController.prototype, "ubah", null);
exports.SertifikatController = SertifikatController = __decorate([
    (0, common_1.Controller)('sertifikat'),
    __metadata("design:paramtypes", [sertifikat_repository_1.SertifikatRepository])
], SertifikatController);
function rapikan(p, tanggalSaran) {
    return {
        nomor: p.nomor,
        tanggalKalibrasi: p.tanggalKalibrasi,
        tanggalSaran,
        hasil: p.hasil ?? null,
        pelaksana: p.pelaksana ?? null,
    };
}
function tolakBilaSalah(isi, kini) {
    const salah = (0, sertifikat_1.periksaSertifikat)(isi, kini);
    if (salah.length)
        throw new common_1.BadRequestException({
            code: 'SERTIFIKAT_TIDAK_SAH',
            message: 'Isian sertifikat belum benar',
            details: salah,
        });
}
//# sourceMappingURL=sertifikat.controller.js.map