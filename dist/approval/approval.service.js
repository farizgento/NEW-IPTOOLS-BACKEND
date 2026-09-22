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
var ApprovalService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalService = void 0;
const common_1 = require("@nestjs/common");
const approval_repository_1 = require("./approval.repository");
const keputusan_1 = require("./keputusan");
let ApprovalService = ApprovalService_1 = class ApprovalService {
    repo;
    log = new common_1.Logger(ApprovalService_1.name);
    constructor(repo) {
        this.repo = repo;
    }
    /** Tahap yang boleh diputuskan seseorang, diturunkan dari perannya. */
    tahapUntuk(pengguna) {
        return Object.keys(keputusan_1.PERAN_TAHAP).filter((tahap) => keputusan_1.PERAN_TAHAP[tahap].some((peran) => pengguna.peran.includes(peran)));
    }
    async antrean(pengguna) {
        const tahap = this.tahapUntuk(pengguna);
        if (!tahap.length || pengguna.unitId === null) {
            // Unit belum tercatat berarti antrean tidak dapat dibatasi lingkupnya.
            // Menampilkan seluruh unit akan salah; menampilkan kosong jujur adanya.
            return { jumlah: 0, isi: [] };
        }
        const isi = await this.repo.antrean(tahap, pengguna.unitId);
        return {
            jumlah: isi.length,
            isi: isi.map((item) => ({
                ...item,
                // Umur menunggu ditandai supaya yang tertinggal tidak tenggelam.
                penanda: item.umurHari > 7 ? 'terlambat' : item.umurHari > 3 ? 'tertunda' : 'biasa',
            })),
        };
    }
    async berkas(peminjamanId, pengguna) {
        const berkas = await this.repo.berkas(peminjamanId);
        if (!berkas.pengajuan)
            throw new common_1.NotFoundException(`Pengajuan #${peminjamanId} tidak ditemukan`);
        const rantai = await this.repo.rantai(peminjamanId);
        const status = String(berkas.pengajuan.STATUS ?? '');
        const izin = (0, keputusan_1.bolehMemutuskan)(rantai, pengguna.peran, status);
        return {
            ...berkas,
            dapatDiputuskan: izin.boleh,
            alasanTidakDapat: izin.boleh ? null : izin.alasan,
            tahapBerjalan: izin.boleh ? izin.baris.tahap : null,
            alasanSiapPakai: keputusan_1.ALASAN_SIAP_PAKAI,
        };
    }
    async putuskan(peminjamanId, pengguna, keputusan, alasan) {
        const berkas = await this.repo.berkas(peminjamanId);
        if (!berkas.pengajuan)
            throw new common_1.NotFoundException(`Pengajuan #${peminjamanId} tidak ditemukan`);
        const statusLama = String(berkas.pengajuan.STATUS ?? '');
        const rantai = await this.repo.rantai(peminjamanId);
        const izin = (0, keputusan_1.bolehMemutuskan)(rantai, pengguna.peran, statusLama);
        if (!izin.boleh)
            throw new common_1.ForbiddenException(izin.alasan);
        // Alasan penolakan ditegakkan di server, bukan hanya di antarmuka.
        const keluhan = (0, keputusan_1.periksaAlasan)(keputusan, alasan);
        if (keluhan) {
            throw new common_1.BadRequestException({
                code: 'ALASAN_WAJIB',
                message: keluhan,
                details: { alasanSiapPakai: keputusan_1.ALASAN_SIAP_PAKAI },
            });
        }
        const statusBaru = (0, keputusan_1.statusSetelahKeputusan)(rantai, izin.baris.tahap, keputusan);
        await this.repo.simpanKeputusan({
            peminjamanId,
            urutan: izin.baris.urutan,
            keputusan,
            alasan: alasan?.trim() ?? null,
            statusBaru,
            statusLama,
            penyetujuId: pengguna.id,
            namaPenyetuju: pengguna.nama,
            keterangan: keputusan === 'TOLAK'
                ? `Ditolak pada tahap ${izin.baris.tahap}: ${alasan?.trim()}`
                : `Disetujui pada tahap ${izin.baris.tahap}`,
        });
        this.log.log(`Pengajuan #${peminjamanId} ${keputusan} pada tahap ${izin.baris.tahap} ` +
            `oleh ${pengguna.username ?? pengguna.email} → ${statusBaru}`);
        return { status: statusBaru, tahap: izin.baris.tahap };
    }
};
exports.ApprovalService = ApprovalService;
exports.ApprovalService = ApprovalService = ApprovalService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [approval_repository_1.ApprovalRepository])
], ApprovalService);
//# sourceMappingURL=approval.service.js.map