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
exports.MasterController = void 0;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const master_repository_1 = require("./master.repository");
const auth_guard_1 = require("../auth/auth.guard");
const proyek_1 = require("./proyek");
const tipeSkema = zod_1.z.enum(master_repository_1.TIPE_REFERENSI);
const skemaUnit = zod_1.z.object({
    nama: zod_1.z.string().trim().min(1).max(255),
    kodeRe: zod_1.z.coerce.number().int().nullable().optional(),
    kodeMaximo: zod_1.z.string().trim().max(60).nullable().optional(),
    deskripsi: zod_1.z.string().trim().max(255).nullable().optional(),
});
const skemaProyek = zod_1.z.object({
    nama: zod_1.z.string().trim().min(1).max(255),
    tanggalMulai: zod_1.z.string().trim().nullable().optional(),
    tanggalSelesai: zod_1.z.string().trim().nullable().optional(),
    site: zod_1.z.string().trim().max(255).nullable().optional(),
    tipeOhId: zod_1.z.coerce.number().int().positive().nullable().optional(),
});
const isiProyek = (p) => ({
    nama: p.nama,
    tanggalMulai: p.tanggalMulai ?? null,
    tanggalSelesai: p.tanggalSelesai ?? null,
    site: p.site ?? null,
    tipeOhId: p.tipeOhId ?? null,
});
const namaKembar = (apa) => new common_1.ConflictException({
    code: 'NAMA_SUDAH_ADA',
    message: `${apa} dengan nama itu sudah terdaftar`,
});
function tolakProyekSalah(isi) {
    const salah = (0, proyek_1.periksaProyek)(isi);
    if (salah.length)
        throw new common_1.BadRequestException({
            code: 'PROYEK_TIDAK_SAH',
            message: 'Isian proyek belum benar',
            details: salah,
        });
}
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
let MasterController = class MasterController {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    /** Daftar kerja kesiapan data — halaman muka master data. */
    kesiapan() {
        return this.repo.kesiapan();
    }
    unit(termasukNonaktif) {
        return this.repo.unit(termasukNonaktif === 'true');
    }
    async tambahUnit(badan) {
        const p = uraikan(skemaUnit, badan);
        if (await this.repo.unitBernamaSama(p.nama))
            throw namaKembar('Unit');
        const id = await this.repo.tambahUnit({
            nama: p.nama,
            kodeRe: p.kodeRe ?? null,
            kodeMaximo: p.kodeMaximo ?? null,
            deskripsi: p.deskripsi ?? null,
        });
        return this.repo.unitSatu(id);
    }
    async ubahUnit(id, badan) {
        if (!(await this.repo.unitSatu(id)))
            throw new common_1.NotFoundException({ code: 'UNIT_TIDAK_ADA', message: 'Unit tidak ditemukan' });
        const p = uraikan(skemaUnit.extend({ nonaktif: zod_1.z.boolean().default(false) }), badan);
        if (await this.repo.unitBernamaSama(p.nama, id))
            throw namaKembar('Unit');
        await this.repo.ubahUnit(id, {
            nama: p.nama,
            kodeRe: p.kodeRe ?? null,
            kodeMaximo: p.kodeMaximo ?? null,
            deskripsi: p.deskripsi ?? null,
            nonaktif: p.nonaktif,
        });
        return this.repo.unitSatu(id);
    }
    /** Daftar proyek/pekerjaan yang muncul sebagai pilihan saat mengajukan. */
    proyek(kueri) {
        const p = uraikan(zod_1.z.object({
            cari: zod_1.z.string().trim().optional(),
            tanpaTipeOh: zod_1.z
                .enum(['true', 'false'])
                .optional()
                .transform((v) => v === 'true'),
            halaman: zod_1.z.coerce.number().int().min(1).default(1),
            perHalaman: zod_1.z.coerce.number().int().min(1).max(100).default(20),
        }), kueri);
        return this.repo.proyek(p);
    }
    async tambahProyek(badan) {
        const isi = isiProyek(uraikan(skemaProyek, badan));
        tolakProyekSalah(isi);
        if (await this.repo.proyekBernamaSama(isi.nama))
            throw namaKembar('Proyek');
        const id = await this.repo.tambahProyek(isi);
        return this.repo.proyekSatu(id);
    }
    async ubahProyek(id, badan) {
        if (!(await this.repo.proyekSatu(id)))
            throw new common_1.NotFoundException({ code: 'PROYEK_TIDAK_ADA', message: 'Proyek tidak ditemukan' });
        const isi = isiProyek(uraikan(skemaProyek, badan));
        tolakProyekSalah(isi);
        if (await this.repo.proyekBernamaSama(isi.nama, id))
            throw namaKembar('Proyek');
        await this.repo.ubahProyek(id, isi);
        return this.repo.proyekSatu(id);
    }
    /**
     * Nama pekerjaan yang diketik bebas dan belum terdaftar, beserta saran proyek
     * yang mungkin sama. Saran tetap saran: penggabungan keputusan admin.
     */
    async pekerjaanLepas(kueri) {
        const p = uraikan(zod_1.z.object({ batas: zod_1.z.coerce.number().int().min(1).max(200).default(40) }), kueri);
        const [baris, jumlah, daftarProyek] = await Promise.all([
            this.repo.pekerjaanLepas(p.batas),
            this.repo.jumlahPekerjaanLepas(),
            this.repo.proyek({ halaman: 1, perHalaman: 100 }),
        ]);
        const proyek = daftarProyek.isi;
        const isi = baris.map((b) => {
            const saran = proyek
                .map((x) => ({ id: x.ID, nama: x.NAMA, nilai: (0, proyek_1.miripProyek)(b.NAMA, x.NAMA) }))
                .filter((x) => x.nilai >= proyek_1.AMBANG_MIRIP)
                .sort((a, b2) => b2.nilai - a.nilai)[0];
            return {
                nama: b.NAMA,
                jumlah: Number(b.JUMLAH),
                terakhir: b.TERAKHIR,
                saran: saran ? { id: saran.id, nama: saran.nama } : null,
            };
        });
        return { jumlah, isi };
    }
    bidang() {
        return this.repo.bidang();
    }
    referensi(tipe) {
        return this.repo.referensi(uraikan(tipeSkema, tipe));
    }
    async tambah(tipe, badan) {
        const p = uraikan(zod_1.z.object({ kode: zod_1.z.string().trim().min(1).max(60), nama: zod_1.z.string().trim().min(1).max(255) }), badan);
        await this.repo.tambahReferensi(uraikan(tipeSkema, tipe), p.kode, p.nama);
        return this.repo.referensi(uraikan(tipeSkema, tipe));
    }
    async ubah(id, badan) {
        const p = uraikan(zod_1.z.object({ nama: zod_1.z.string().trim().min(1).max(255), aktif: zod_1.z.boolean().default(true) }), badan);
        await this.repo.ubahReferensi(id, p.nama, p.aktif);
        return { diubah: id };
    }
    /**
     * Menggabungkan dua pilihan yang sebenarnya sama.
     *
     * Migrasi mendaftarkan 38 nilai apa adanya karena dipakai data lama tanpa
     * pernah terdaftar. Sebagian di antaranya ejaan berbeda dari hal yang sama,
     * dan inilah cara merapikannya tanpa kehilangan kaitan alat.
     */
    async gabung(id, badan) {
        const p = uraikan(zod_1.z.object({ keId: zod_1.z.coerce.number().int().positive() }), badan);
        if (p.keId === id) {
            throw new common_1.BadRequestException({
                code: 'GABUNG_KE_DIRI_SENDIRI',
                message: 'Pilihan tidak dapat digabungkan ke dirinya sendiri',
            });
        }
        const dialihkan = await this.repo.gabungReferensi(id, p.keId);
        return { dari: id, ke: p.keId, alatDialihkan: dialihkan };
    }
    /** Layar "Pengguna tanpa unit" (PRD 6.2.1). */
    async penggunaTanpaUnit(hanyaBerperan) {
        const isi = await this.repo.penggunaTanpaUnit(hanyaBerperan !== 'false');
        return { jumlah: isi.length, isi };
    }
    async tetapkanUnit(id, badan) {
        const p = uraikan(zod_1.z.object({ unitId: zod_1.z.coerce.number().int().positive() }), badan);
        // Asal nilai dicatat agar penyelarasan kepegawaian kelak dapat menimpanya
        // dengan benar, dan selisihnya dilaporkan (PRD 6.2.1).
        await this.repo.tetapkanUnit(id, p.unitId, 'ADMIN');
        return { penggunaId: id, unitId: p.unitId, sumberUnit: 'ADMIN' };
    }
};
exports.MasterController = MasterController;
__decorate([
    (0, common_1.Get)('kesiapan'),
    (0, auth_guard_1.ButuhPeran)('ADMIN_UNIT', 'ADMIN_SUPER'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "kesiapan", null);
__decorate([
    (0, common_1.Get)('unit'),
    __param(0, (0, common_1.Query)('termasukNonaktif')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "unit", null);
__decorate([
    (0, common_1.Post)('unit'),
    (0, auth_guard_1.ButuhPeran)('ADMIN_SUPER'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "tambahUnit", null);
__decorate([
    (0, common_1.Patch)('unit/:id'),
    (0, auth_guard_1.ButuhPeran)('ADMIN_SUPER'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "ubahUnit", null);
__decorate([
    (0, common_1.Get)('proyek'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "proyek", null);
__decorate([
    (0, common_1.Post)('proyek'),
    (0, auth_guard_1.ButuhPeran)('ADMIN_UNIT', 'ADMIN_SUPER'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "tambahProyek", null);
__decorate([
    (0, common_1.Patch)('proyek/:id'),
    (0, auth_guard_1.ButuhPeran)('ADMIN_UNIT', 'ADMIN_SUPER'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "ubahProyek", null);
__decorate([
    (0, common_1.Get)('pekerjaan-lepas'),
    (0, auth_guard_1.ButuhPeran)('ADMIN_UNIT', 'ADMIN_SUPER'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "pekerjaanLepas", null);
__decorate([
    (0, common_1.Get)('bidang'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "bidang", null);
__decorate([
    (0, common_1.Get)('referensi/:tipe'),
    __param(0, (0, common_1.Param)('tipe')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "referensi", null);
__decorate([
    (0, common_1.Post)('referensi/:tipe'),
    (0, auth_guard_1.ButuhPeran)('ADMIN_SUPER'),
    __param(0, (0, common_1.Param)('tipe')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "tambah", null);
__decorate([
    (0, common_1.Patch)('referensi/:id'),
    (0, auth_guard_1.ButuhPeran)('ADMIN_SUPER'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "ubah", null);
__decorate([
    (0, common_1.Post)('referensi/:id/gabung'),
    (0, auth_guard_1.ButuhPeran)('ADMIN_SUPER'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "gabung", null);
__decorate([
    (0, common_1.Get)('pengguna-tanpa-unit'),
    (0, auth_guard_1.ButuhPeran)('ADMIN_UNIT', 'ADMIN_SUPER'),
    __param(0, (0, common_1.Query)('hanyaBerperan')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "penggunaTanpaUnit", null);
__decorate([
    (0, common_1.Patch)('pengguna/:id/unit'),
    (0, auth_guard_1.ButuhPeran)('ADMIN_UNIT', 'ADMIN_SUPER'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "tetapkanUnit", null);
exports.MasterController = MasterController = __decorate([
    (0, common_1.Controller)('master'),
    __metadata("design:paramtypes", [master_repository_1.MasterRepository])
], MasterController);
//# sourceMappingURL=master.controller.js.map