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
exports.LaporanController = void 0;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const laporan_repository_1 = require("./laporan.repository");
const skemaTahun = zod_1.z.object({
    tahun: zod_1.z.coerce.number().int().min(2000).max(2100).default(new Date().getFullYear()),
    unitId: zod_1.z.coerce.number().int().positive().optional(),
});
let LaporanController = class LaporanController {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    /** Efektivitas alat: pemakaian setahun dibanding estimasinya. */
    async efektivitas(kueri) {
        const p = skemaTahun.parse(kueri);
        const isi = await this.repo.efektivitas(p.tahun, p.unitId);
        const hitung = (nilai) => isi.filter((r) => r.EFEKTIVITAS === nilai).length;
        return {
            tahun: p.tahun,
            ringkasan: {
                efektif: hitung('EFEKTIF'),
                tidakEfektif: hitung('TIDAK EFEKTIF'),
                tidakDiukur: hitung('TIDAK DIUKUR'),
            },
            isi,
        };
    }
    async pemakaianBulanan(kueri) {
        const p = skemaTahun.parse(kueri);
        return { tahun: p.tahun, isi: await this.repo.pemakaianBulanan(p.tahun, p.unitId) };
    }
    riwayat(id) {
        return this.repo.rincianPemakaian(id);
    }
    dashboard(unitId) {
        const id = unitId ? Number(unitId) : undefined;
        return this.repo.dashboard(Number.isFinite(id) ? id : undefined);
    }
};
exports.LaporanController = LaporanController;
__decorate([
    (0, common_1.Get)('efektivitas'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], LaporanController.prototype, "efektivitas", null);
__decorate([
    (0, common_1.Get)('pemakaian-bulanan'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], LaporanController.prototype, "pemakaianBulanan", null);
__decorate([
    (0, common_1.Get)('alat/:id/riwayat'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], LaporanController.prototype, "riwayat", null);
__decorate([
    (0, common_1.Get)('dashboard'),
    __param(0, (0, common_1.Query)('unitId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LaporanController.prototype, "dashboard", null);
exports.LaporanController = LaporanController = __decorate([
    (0, common_1.Controller)('laporan'),
    __metadata("design:paramtypes", [laporan_repository_1.LaporanRepository])
], LaporanController);
//# sourceMappingURL=laporan.controller.js.map