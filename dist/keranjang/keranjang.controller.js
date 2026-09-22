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
exports.KeranjangController = void 0;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const keranjang_repository_1 = require("./keranjang.repository");
const skemaTambah = zod_1.z.object({ alatId: zod_1.z.coerce.number().int().positive() });
let KeranjangController = class KeranjangController {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    async isi(permintaan) {
        const isi = await this.repo.isi(permintaan.pengguna.id);
        return { jumlah: isi.length, isi };
    }
    async tambah(permintaan, badan) {
        const { alatId } = skemaTambah.parse(badan);
        await this.repo.tambah(permintaan.pengguna.id, alatId);
        return this.isi(permintaan);
    }
    async hapus(permintaan, alatId) {
        await this.repo.hapus(permintaan.pengguna.id, alatId);
        return this.isi(permintaan);
    }
    async kosongkan(permintaan) {
        await this.repo.kosongkan(permintaan.pengguna.id);
        return { jumlah: 0, isi: [] };
    }
};
exports.KeranjangController = KeranjangController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], KeranjangController.prototype, "isi", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], KeranjangController.prototype, "tambah", null);
__decorate([
    (0, common_1.Delete)(':alatId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('alatId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], KeranjangController.prototype, "hapus", null);
__decorate([
    (0, common_1.Delete)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], KeranjangController.prototype, "kosongkan", null);
exports.KeranjangController = KeranjangController = __decorate([
    (0, common_1.Controller)('keranjang'),
    __metadata("design:paramtypes", [keranjang_repository_1.KeranjangRepository])
], KeranjangController);
//# sourceMappingURL=keranjang.controller.js.map