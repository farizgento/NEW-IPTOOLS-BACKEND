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
exports.KuesionerController = void 0;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const kuesioner_repository_1 = require("./kuesioner.repository");
const auth_guard_1 = require("../auth/auth.guard");
const kuesioner_1 = require("./kuesioner");
const teks = zod_1.z.string().trim().max(500).optional().nullable();
const skemaSesi = zod_1.z.object({
    peminjamanId: zod_1.z.coerce.number().int().positive().optional().nullable(),
    namaPerusahaan: teks,
    namaUnit: teks,
    jenjangJabatan: teks,
    bidangPekerjaan: teks,
    unitOh: teks,
    jenisInspeksi: teks,
});
const skemaJawaban = zod_1.z.object({
    jawaban: zod_1.z
        .array(zod_1.z.object({
        pertanyaanId: zod_1.z.coerce.number().int().positive(),
        kepentingan: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional().nullable(),
        kinerja: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional().nullable(),
        teks: zod_1.z.string().max(2000).optional().nullable(),
    }))
        .min(1),
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
/** Kuesioner kepuasan (PRD F14). */
let KuesionerController = class KuesionerController {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    pertanyaan() {
        return this.repo.pertanyaanAktif();
    }
    async buat(permintaan, badan) {
        const p = uraikan(skemaSesi, badan);
        const pengguna = permintaan.pengguna;
        const id = await this.repo.buat({
            peminjamanId: p.peminjamanId ?? null,
            namaPerusahaan: p.namaPerusahaan ?? null,
            namaUnit: p.namaUnit ?? pengguna.namaUnit,
            jenjangJabatan: p.jenjangJabatan ?? null,
            bidangPekerjaan: p.bidangPekerjaan ?? null,
            unitOh: p.unitOh ?? null,
            jenisInspeksi: p.jenisInspeksi ?? null,
            pengisiId: pengguna.id,
            namaPengisi: pengguna.nama,
        });
        return { id, status: 'DRAFT' };
    }
    async rekap() {
        const [pertanyaan, baris, masukan] = await Promise.all([
            this.repo.pertanyaanAktif(),
            this.repo.barisRekap(),
            this.repo.masukanTeks(),
        ]);
        const nama = new Map(pertanyaan.map((p) => [p.id, p]));
        return {
            penilaian: (0, kuesioner_1.rekapIpa)(baris).map((r) => ({
                ...r,
                kategori: nama.get(r.pertanyaanId)?.kategori ?? null,
                pertanyaan: nama.get(r.pertanyaanId)?.pertanyaan ?? null,
            })),
            kritikDanSaran: masukan,
        };
    }
    async ambil(id) {
        const hasil = await this.repo.ambil(id);
        if (!hasil)
            throw new common_1.NotFoundException(`Kuesioner #${id} tidak ditemukan`);
        return hasil;
    }
    async jawab(id, permintaan, badan) {
        const sesi = await this.repo.ambil(id);
        if (!sesi)
            throw new common_1.NotFoundException(`Kuesioner #${id} tidak ditemukan`);
        const pengguna = permintaan.pengguna;
        if (Number(sesi.sesi.PENGISI_ID) !== pengguna.id) {
            throw new common_1.ForbiddenException('Kuesioner ini milik pengisi lain');
        }
        const p = uraikan(skemaJawaban, badan);
        const pertanyaan = await this.repo.pertanyaanAktif();
        const pelanggaran = (0, kuesioner_1.validasiJawaban)(pertanyaan, p.jawaban);
        if (pelanggaran.length) {
            throw new common_1.BadRequestException({
                code: 'JAWABAN_TIDAK_SAH',
                message: 'Ada jawaban yang perlu dibetulkan',
                details: pelanggaran,
            });
        }
        const hasil = await this.repo.simpanJawaban({
            kuesionerId: id,
            pertanyaan,
            jawaban: p.jawaban,
            penjawabId: pengguna.id,
            email: pengguna.email,
        });
        return {
            ...hasil,
            catatan: hasil.status === 'SUBMIT'
                ? 'Terima kasih, kuesioner lengkap.'
                : `Tersimpan. ${hasil.jumlahPertanyaan - hasil.terjawab} pertanyaan belum dijawab.`,
        };
    }
};
exports.KuesionerController = KuesionerController;
__decorate([
    (0, common_1.Get)('pertanyaan'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], KuesionerController.prototype, "pertanyaan", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], KuesionerController.prototype, "buat", null);
__decorate([
    (0, common_1.Get)('rekap'),
    (0, auth_guard_1.ButuhPeran)('ADMIN_UNIT', 'ADMIN_SUPER', 'MANAJER'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], KuesionerController.prototype, "rekap", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], KuesionerController.prototype, "ambil", null);
__decorate([
    (0, common_1.Put)(':id/jawaban'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", Promise)
], KuesionerController.prototype, "jawab", null);
exports.KuesionerController = KuesionerController = __decorate([
    (0, common_1.Controller)('kuesioner'),
    __metadata("design:paramtypes", [kuesioner_repository_1.KuesionerRepository])
], KuesionerController);
//# sourceMappingURL=kuesioner.controller.js.map