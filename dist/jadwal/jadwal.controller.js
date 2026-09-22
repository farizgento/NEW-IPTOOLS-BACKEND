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
exports.JadwalController = void 0;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const jadwal_repository_1 = require("./jadwal.repository");
const jadwal_1 = require("./jadwal");
const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const MAKS_HARI = 366;
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
const skema = zod_1.z.object({
    dari: zod_1.z.string().trim().regex(TANGGAL).optional(),
    sampai: zod_1.z.string().trim().regex(TANGGAL).optional(),
    unitId: zod_1.z.coerce.number().int().positive().optional(),
    bidangId: zod_1.z.coerce.number().int().positive().optional(),
    cari: zod_1.z.string().trim().optional(),
    batasAlat: zod_1.z.coerce.number().int().min(1).max(500).default(300),
});
const geser = (t, hari) => new Date(Date.parse(t) + hari * 86_400_000).toISOString().slice(0, 10);
/** Senin pada pekan tanggal tersebut; jendela bawaan dimulai dari sana. */
const senin = (t) => geser(t, -(((new Date(`${t}T00:00:00Z`).getUTCDay() + 6) % 7)));
let JadwalController = class JadwalController {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    /**
     * Jadwal pemakaian alat untuk dashboard.
     *
     * Tanpa tanggal, jendelanya delapan pekan mulai Senin pekan ini — sama dengan
     * bawaan di layar, supaya pemanggilan pertama tidak perlu menghitung apa pun.
     */
    async daftar(kueri) {
        const hasil = skema.safeParse(kueri);
        if (!hasil.success) {
            throw new common_1.BadRequestException({
                code: 'PERMINTAAN_TIDAK_SAH',
                message: 'Isian tidak lengkap',
                details: hasil.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
            });
        }
        const p = hasil.data;
        const hariIni = new Date().toISOString().slice(0, 10);
        const dari = p.dari ?? senin(hariIni);
        let sampai = p.sampai ?? geser(dari, 55);
        if (sampai < dari)
            sampai = dari;
        if (Date.parse(sampai) - Date.parse(dari) > (MAKS_HARI - 1) * 86_400_000)
            sampai = geser(dari, MAKS_HARI - 1);
        const isi = await this.repo.perAlat({
            dari,
            sampai,
            unitId: p.unitId,
            bidangId: p.bidangId,
            cari: p.cari,
            batasAlat: p.batasAlat,
        }, hariIni);
        return {
            dari,
            sampai,
            hariIni,
            jumlahAlat: isi.length,
            ringkasan: (0, jadwal_1.ringkasJadwal)(isi),
            isi,
        };
    }
    /**
     * Jadwal lain yang bertumpuk dengan periode yang diminta, per alat.
     *
     * Dipakai dua tempat: saat peminjam menyusun pengajuan di katalog, dan saat
     * pengelola memutuskan. Keduanya hanya diberi peringatan — pengajuan yang
     * bertabrakan tetap boleh dikirim dan tetap boleh disetujui (keputusan
     * 2026-09-18); pengelola yang menimbang.
     */
    async tabrakan(kueri) {
        const p = uraikan(zod_1.z.object({
            alatIds: zod_1.z
                .string()
                .trim()
                .min(1)
                .transform((t) => t.split(',').map((x) => Number(x.trim())))
                .refine((a) => a.length > 0 && a.length <= 100 && a.every((x) => Number.isInteger(x) && x > 0), {
                message: 'alatIds berisi 1–100 nomor alat',
            }),
            mulai: zod_1.z.string().trim().regex(TANGGAL),
            selesai: zod_1.z.string().trim().regex(TANGGAL),
            kecualiPeminjamanId: zod_1.z.coerce.number().int().positive().optional(),
        }), kueri);
        if (p.selesai < p.mulai)
            throw new common_1.BadRequestException({
                code: 'PERIODE_TIDAK_SAH',
                message: 'Tanggal selesai mendahului tanggal mulai',
            });
        const isi = await this.repo.tabrakanUntuk(p.alatIds, p.mulai, p.selesai, p.kecualiPeminjamanId);
        const perAlat = new Map();
        for (const x of isi) {
            if (!perAlat.has(x.alatId))
                perAlat.set(x.alatId, []);
            perAlat.get(x.alatId).push(x);
        }
        return {
            mulai: p.mulai,
            selesai: p.selesai,
            jumlahAlat: perAlat.size,
            isi: [...perAlat.entries()].map(([alatId, jadwal]) => ({ alatId, jadwal })),
        };
    }
};
exports.JadwalController = JadwalController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], JadwalController.prototype, "daftar", null);
__decorate([
    (0, common_1.Get)('tabrakan'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], JadwalController.prototype, "tabrakan", null);
exports.JadwalController = JadwalController = __decorate([
    (0, common_1.Controller)('jadwal'),
    __metadata("design:paramtypes", [jadwal_repository_1.JadwalRepository])
], JadwalController);
//# sourceMappingURL=jadwal.controller.js.map