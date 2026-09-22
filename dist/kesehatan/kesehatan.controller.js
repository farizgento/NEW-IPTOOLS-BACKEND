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
Object.defineProperty(exports, "__esModule", { value: true });
exports.KesehatanController = void 0;
const common_1 = require("@nestjs/common");
const oracle_service_1 = require("../basisdata/oracle.service");
const pengguna_repository_1 = require("../pengguna/pengguna.repository");
const auth_guard_1 = require("../auth/auth.guard");
let KesehatanController = class KesehatanController {
    db;
    pengguna;
    constructor(db, pengguna) {
        this.db = db;
        this.pengguna = pengguna;
    }
    async periksa() {
        const basisdata = await this.db.periksaKoneksi().catch(() => false);
        return { status: basisdata ? 'sehat' : 'basis data tidak terjangkau', basisdata };
    }
    /**
     * Kesiapan data pengguna. Selama akses kepegawaian belum ada, angka
     * "tanpaUnitBerperan" adalah pekerjaan yang harus selesai sebelum peluncuran
     * (PRD 6.2.1).
     */
    async dataPengguna() {
        return this.pengguna.ringkasan();
    }
};
exports.KesehatanController = KesehatanController;
__decorate([
    (0, auth_guard_1.Publik)(),
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], KesehatanController.prototype, "periksa", null);
__decorate([
    (0, common_1.Get)('data-pengguna'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], KesehatanController.prototype, "dataPengguna", null);
exports.KesehatanController = KesehatanController = __decorate([
    (0, common_1.Controller)('kesehatan'),
    __metadata("design:paramtypes", [oracle_service_1.OracleService,
        pengguna_repository_1.PenggunaRepository])
], KesehatanController);
//# sourceMappingURL=kesehatan.controller.js.map