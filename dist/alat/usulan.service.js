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
var UsulanService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsulanService = void 0;
const common_1 = require("@nestjs/common");
const usulan_repository_1 = require("./usulan.repository");
const usulan_1 = require("./usulan");
const TIPE_BIDANG = {
    JENIS_ALAT: 'jenisId',
    KONDISI_ALAT: 'kondisiId',
    LOKASI_ALAT: 'lokasiId',
};
let UsulanService = UsulanService_1 = class UsulanService {
    repo;
    log = new common_1.Logger(UsulanService_1.name);
    constructor(repo) {
        this.repo = repo;
    }
    /** Menambah alat baru — langsung, seperti sistem lama (PRD 12.9). */
    async tambah(pengguna, masukan) {
        const isi = (0, usulan_1.saringIsi)(masukan);
        if (!String(isi.nama ?? '').trim()) {
            throw new common_1.BadRequestException({
                code: 'NAMA_WAJIB',
                message: 'Nama alat wajib diisi',
            });
        }
        const pelanggaran = (0, usulan_1.validasiUsulan)('UBAH', isi);
        if (pelanggaran.length) {
            throw new common_1.BadRequestException({
                code: 'ISIAN_TIDAK_SAH',
                message: 'Ada isian yang tidak sah',
                details: pelanggaran,
            });
        }
        const id = await this.repo.tambah(isi, pengguna.id);
        this.log.log(`Alat #${id} ditambahkan oleh ${pengguna.nama}`);
        return { id };
    }
    async usulkan(pengguna, alatId, tindakan, masukan, keterangan) {
        const isi = tindakan === 'HAPUS' ? {} : (0, usulan_1.saringIsi)(masukan);
        const pelanggaran = (0, usulan_1.validasiUsulan)(tindakan, isi);
        if (pelanggaran.length) {
            throw new common_1.BadRequestException({
                code: 'USULAN_TIDAK_SAH',
                message: 'Usulan tidak dapat diterima',
                details: pelanggaran,
            });
        }
        const tertahan = (0, usulan_1.bolehMengusulkan)(await this.repo.jumlahMenunggu(alatId));
        if (tertahan) {
            throw new common_1.ConflictException({ code: 'USULAN_MENUNGGU', message: tertahan.message });
        }
        const id = await this.repo.buatUsulan({
            alatId,
            tindakan,
            isi,
            keterangan,
            oleh: pengguna.id,
            nama: pengguna.nama,
        });
        this.log.log(`Usulan #${id} (${tindakan}) atas alat #${alatId} oleh ${pengguna.nama}`);
        return { id, status: 'WAITING APPROVAL' };
    }
    /** Pencari id referensi dari nama, untuk usulan warisan sistem lama. */
    async pencariReferensi() {
        const peta = new Map();
        for (const r of await this.repo.referensiAlat()) {
            const kunci = `${TIPE_BIDANG[r.TIPE]}:${(0, usulan_1.normalNamaReferensi)(r.NAMA)}`;
            if (!peta.has(kunci))
                peta.set(kunci, Number(r.ID));
        }
        return (bidang, nama) => peta.get(`${bidang}:${(0, usulan_1.normalNamaReferensi)(nama)}`);
    }
    async menunggu() {
        const [daftar, cari] = await Promise.all([this.repo.menunggu(), this.pencariReferensi()]);
        return daftar.map((u) => {
            const { isi, takTerpetakan } = (0, usulan_1.bakukanIsiLama)(u.isi, cari);
            return { ...u, isi, takTerpetakan };
        });
    }
    riwayat(alatId) {
        return this.repo.riwayat(alatId);
    }
    async putuskan(pengguna, usulanId, keputusan, alasan) {
        const usulan = await this.repo.ambil(usulanId);
        if (!usulan)
            throw new common_1.NotFoundException(`Usulan #${usulanId} tidak ditemukan`);
        const izin = (0, usulan_1.periksaKeputusan)({
            statusSaatIni: usulan.status,
            keputusan,
            alasan,
            // Ditegakkan di server. Procedure lama menerima nama dan email pemutus
            // sebagai parameter lalu memakainya begitu saja.
            adalahPemutusSah: pengguna.peran.includes('ADMIN_SUPER'),
        });
        if (!izin.boleh)
            throw new common_1.ForbiddenException(izin.alasan);
        const { isi, takTerpetakan } = (0, usulan_1.bakukanIsiLama)(usulan.isi, await this.pencariReferensi());
        if (keputusan === 'SETUJU' && usulan.tindakan === 'UBAH' && takTerpetakan.length) {
            throw new common_1.BadRequestException({
                code: 'ISI_USULAN_TIDAK_DIKENAL',
                message: `Usulan tidak dapat diterapkan: ${takTerpetakan.join(', ')} tidak ada di data referensi. Tolak usulan ini atau tambahkan referensinya dulu.`,
            });
        }
        const status = (0, usulan_1.statusRiwayat)(keputusan);
        await this.repo.putuskan({
            usulanId,
            alatId: usulan.alatId,
            tindakan: usulan.tindakan,
            isi,
            status,
            keterangan: alasan?.trim() ?? null,
            oleh: pengguna.id,
            nama: pengguna.nama,
        });
        this.log.log(`Usulan #${usulanId} ${status} oleh ${pengguna.nama}`);
        return { id: usulanId, status };
    }
};
exports.UsulanService = UsulanService;
exports.UsulanService = UsulanService = UsulanService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [usulan_repository_1.UsulanRepository])
], UsulanService);
//# sourceMappingURL=usulan.service.js.map