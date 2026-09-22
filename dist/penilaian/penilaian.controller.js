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
exports.PenilaianController = void 0;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const penilaian_repository_1 = require("./penilaian.repository");
const auth_guard_1 = require("../auth/auth.guard");
const penilaian_1 = require("./penilaian");
const TAHAP = ['BOOKED', 'SENT', 'RETURN', 'FINISH', 'KERUSAKAN'];
const skemaSimpan = zod_1.z.object({
    tahap: zod_1.z.enum(TAHAP),
    /** Jalur satu tindakan: seluruh alat dinyatakan kondisi baik. */
    semuaBaik: zod_1.z.boolean().optional(),
    penilaian: zod_1.z
        .array(zod_1.z.object({
        peminjamanAlatId: zod_1.z.coerce.number().int().positive(),
        pilihanIds: zod_1.z.array(zod_1.z.coerce.number().int().positive()),
        keterangan: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
    }))
        .optional(),
});
let PenilaianController = class PenilaianController {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    /** Daftar pilihan kondisi, beserta pilihan bawaan "kondisi baik". */
    async katalog() {
        const semua = await this.repo.katalog();
        return {
            pilihan: semua,
            kondisiBaik: (0, penilaian_1.pilihanKondisiBaik)(semua),
            lengkap: (0, penilaian_1.kondisiBaikLengkap)(semua),
        };
    }
    async alat(id, tahap = 'SENT') {
        const t = TAHAP.includes(tahap) ? tahap : 'SENT';
        return {
            tahap: t,
            alat: await this.repo.alatPengajuan(id, t),
            ringkasan: await this.repo.ringkasan(id, t),
        };
    }
    async simpan(id, permintaan, badan) {
        const hasil = skemaSimpan.safeParse(badan);
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
        const katalog = await this.repo.katalog();
        const peta = new Map(katalog.map((k) => [k.id, k]));
        let penilaian = hasil.data.penilaian ?? [];
        if (hasil.data.semuaBaik) {
            // Satu tindakan untuk seluruh alat: kelima kategori diisi pilihan
            // bernilai 100, tanpa satu pun keterangan (PRD F6).
            if (!(0, penilaian_1.kondisiBaikLengkap)(katalog)) {
                throw new common_1.BadRequestException({
                    code: 'KATALOG_TIDAK_LENGKAP',
                    message: 'Ada grup kategori tanpa pilihan kondisi penuh — hubungi admin',
                });
            }
            const bawaan = (0, penilaian_1.pilihanKondisiBaik)(katalog).map((p) => p.id);
            const alat = await this.repo.alatPengajuan(id, hasil.data.tahap);
            penilaian = alat.map((a) => ({
                peminjamanAlatId: Number(a.PEMINJAMAN_ALAT_ID),
                pilihanIds: bawaan,
            }));
        }
        if (!penilaian.length) {
            throw new common_1.BadRequestException({
                code: 'PENILAIAN_KOSONG',
                message: 'Tidak ada alat yang dinilai',
            });
        }
        const pelanggaran = penilaian.flatMap((p) => (0, penilaian_1.validasiPenilaian)(p, peta).map((x) => ({
            ...x,
            peminjamanAlatId: p.peminjamanAlatId,
        })));
        if (pelanggaran.length) {
            throw new common_1.BadRequestException({
                code: 'PENILAIAN_TIDAK_LENGKAP',
                message: 'Ada kategori yang belum dinilai atau keterangannya belum diisi',
                details: pelanggaran,
            });
        }
        const disimpan = await this.repo.simpan({
            tahap: hasil.data.tahap,
            penilaian,
            oleh: permintaan.pengguna.id,
            nama: permintaan.pengguna.nama,
        });
        return {
            ...disimpan,
            tahap: hasil.data.tahap,
            ringkasan: await this.repo.ringkasan(id, hasil.data.tahap),
        };
    }
};
exports.PenilaianController = PenilaianController;
__decorate([
    (0, common_1.Get)('katalog'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PenilaianController.prototype, "katalog", null);
__decorate([
    (0, common_1.Get)('peminjaman/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('tahap')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], PenilaianController.prototype, "alat", null);
__decorate([
    (0, common_1.Post)('peminjaman/:id')
    // Penilaian kondisi diisi petugas, baik saat mengirim maupun saat menerima
    // kembali; peminjam tidak menilai (PRD F7, F11).
    ,
    (0, auth_guard_1.ButuhPeran)('PENGELOLA', 'STAF'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", Promise)
], PenilaianController.prototype, "simpan", null);
exports.PenilaianController = PenilaianController = __decorate([
    (0, common_1.Controller)('penilaian'),
    __metadata("design:paramtypes", [penilaian_repository_1.PenilaianRepository])
], PenilaianController);
//# sourceMappingURL=penilaian.controller.js.map