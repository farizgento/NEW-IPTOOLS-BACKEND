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
exports.NotifikasiController = void 0;
const common_1 = require("@nestjs/common");
const notifikasi_service_1 = require("./notifikasi.service");
const auth_guard_1 = require("../auth/auth.guard");
let NotifikasiController = class NotifikasiController {
    service;
    constructor(service) {
        this.service = service;
    }
    ringkasan() {
        return this.service.ringkasan();
    }
    /**
     * Menjalankan satu putaran pengingat secara manual.
     *
     * Penjadwal berjalan sendiri, tetapi jalur manual ini membuat aturannya dapat
     * diperiksa kapan saja tanpa menunggu, dan berguna saat memverifikasi
     * perilakunya terhadap data sungguhan.
     */
    jalankan() {
        return this.service.putaran();
    }
};
exports.NotifikasiController = NotifikasiController;
__decorate([
    (0, common_1.Get)('ringkasan'),
    (0, auth_guard_1.ButuhPeran)('ADMIN_UNIT', 'ADMIN_SUPER'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], NotifikasiController.prototype, "ringkasan", null);
__decorate([
    (0, common_1.Post)('jalankan'),
    (0, auth_guard_1.ButuhPeran)('ADMIN_SUPER'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], NotifikasiController.prototype, "jalankan", null);
exports.NotifikasiController = NotifikasiController = __decorate([
    (0, common_1.Controller)('notifikasi'),
    __metadata("design:paramtypes", [notifikasi_service_1.NotifikasiService])
], NotifikasiController);
//# sourceMappingURL=notifikasi.controller.js.map