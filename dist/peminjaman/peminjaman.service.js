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
var PeminjamanService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeminjamanService = void 0;
const common_1 = require("@nestjs/common");
const alat_repository_1 = require("../alat/alat.repository");
const keranjang_repository_1 = require("../keranjang/keranjang.repository");
const alur_1 = require("./alur");
const peminjaman_repository_1 = require("./peminjaman.repository");
const validasi_1 = require("./validasi");
const NAMA_ALUR = {
    DALAM_UNIT: 'Dalam unit',
    DALAM_UNIT_GUDANG: 'Dalam unit — ambil di gudang',
    ANTAR_UNIT: 'Antar unit / antar Area UJH',
    EKSTERNAL: 'PLN Group / eksternal',
};
const NAMA_TAHAP = {
    PENGELOLA: 'SP Tool / SPS',
    MANAJER: 'Manajer Tool',
    GM: 'GM / Pimpinan tertinggi',
};
let PeminjamanService = PeminjamanService_1 = class PeminjamanService {
    repo;
    keranjang;
    alat;
    log = new common_1.Logger(PeminjamanService_1.name);
    constructor(repo, keranjang, alat) {
        this.repo = repo;
        this.keranjang = keranjang;
        this.alat = alat;
    }
    /**
     * Ringkasan yang ditampilkan sebelum tombol kirim (PRD F2): berapa alat,
     * jenis peminjaman yang terdeteksi, dan siapa saja yang akan menyetujui.
     *
     * Memakai perhitungan yang sama persis dengan checkout, sehingga yang dilihat
     * pengguna tidak pernah berbeda dari yang benar-benar terjadi.
     */
    async ringkasan(pengguna, ambilDiGudang = false) {
        const isi = await this.keranjang.isi(pengguna.id);
        const alatIds = isi.map((i) => i.alatId);
        const unitAlat = await this.alat.unitPemilik(alatIds);
        const alur = (0, alur_1.tentukanAlur)({
            unitPeminjamId: pengguna.unitId,
            unitAlatIds: alatIds.map((id) => unitAlat.get(id) ?? null),
            ambilDiGudang,
        });
        const peringatan = [];
        if (pengguna.unitId === null) {
            peringatan.push('Unit Anda belum tercatat, sehingga pengajuan diperlakukan sebagai antar unit ' +
                'dan menuntut persetujuan Manajer. Lengkapi unit Anda agar alurnya tepat.');
        }
        const tidakTersedia = isi.filter((i) => !i.tersedia);
        if (tidakTersedia.length) {
            peringatan.push(`Sedang dipakai peminjaman lain: ${tidakTersedia.map((i) => i.nama).join(', ')}`);
        }
        const kembar = await this.repo.dugaanKembar(pengguna.id, alatIds);
        const pesanKembar = (0, validasi_1.ringkasDugaanKembar)(kembar);
        if (pesanKembar)
            peringatan.push(pesanKembar);
        return {
            jumlahAlat: isi.length,
            alur,
            namaAlur: NAMA_ALUR[alur],
            akanMenyetujui: (0, alur_1.rantaiUntuk)(alur).map((t) => NAMA_TAHAP[t] ?? t),
            peringatan,
        };
    }
    async checkout(pengguna, permintaan) {
        const isi = await this.keranjang.isi(pengguna.id);
        const alatIds = isi.map((i) => i.alatId);
        const pelanggaran = (0, validasi_1.validasiPengajuan)({
            pekerjaan: permintaan.pekerjaan,
            nomorWo: permintaan.nomorWo,
            tanggalMulai: permintaan.tanggalMulai,
            tanggalSelesai: permintaan.tanggalSelesai,
            alatIds,
        });
        if (pelanggaran.length) {
            throw new common_1.BadRequestException({
                code: 'PENGAJUAN_TIDAK_LENGKAP',
                message: 'Ada isian yang perlu dilengkapi sebelum pengajuan dikirim',
                details: pelanggaran,
            });
        }
        if (!permintaan.abaikanDugaanKembar) {
            const kembar = await this.repo.dugaanKembar(pengguna.id, alatIds);
            const pesan = (0, validasi_1.ringkasDugaanKembar)(kembar);
            if (pesan) {
                // Peringatan, bukan larangan: meminjam alat yang sama dua kali bisa sah.
                throw new common_1.BadRequestException({
                    code: 'DUGAAN_PENGAJUAN_KEMBAR',
                    message: pesan,
                    details: kembar,
                    petunjuk: 'Kirim ulang dengan abaikanDugaanKembar=true bila memang disengaja.',
                });
            }
        }
        const unitAlat = await this.alat.unitPemilik(alatIds);
        const alur = (0, alur_1.tentukanAlur)({
            unitPeminjamId: pengguna.unitId,
            unitAlatIds: alatIds.map((id) => unitAlat.get(id) ?? null),
            ambilDiGudang: permintaan.ambilDiGudang ?? false,
        });
        const id = await this.repo.simpanPengajuan({
            pekerjaan: permintaan.pekerjaan.trim(),
            unitId: pengguna.unitId,
            tanggalMulai: permintaan.tanggalMulai,
            tanggalSelesai: permintaan.tanggalSelesai,
            nomorWo: permintaan.nomorWo.trim(),
            tujuan: permintaan.tujuan?.trim() ?? null,
            kontak: permintaan.kontak?.trim() ?? null,
            peminjamId: pengguna.id,
            namaPeminjam: pengguna.nama,
            alur,
            rantai: (0, alur_1.rantaiUntuk)(alur),
            alatIds,
        }, 
        // Keranjang dikosongkan di dalam transaksi yang sama: bila pengajuan
        // batal, keranjangnya kembali utuh.
        async (koneksi) => {
            await this.keranjang.kosongkan(pengguna.id, koneksi);
        });
        this.log.log(`Pengajuan #${id} dibuat oleh ${pengguna.username ?? pengguna.email} (${alur})`);
        return { id };
    }
};
exports.PeminjamanService = PeminjamanService;
exports.PeminjamanService = PeminjamanService = PeminjamanService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [peminjaman_repository_1.PeminjamanRepository,
        keranjang_repository_1.KeranjangRepository,
        alat_repository_1.AlatRepository])
], PeminjamanService);
//# sourceMappingURL=peminjaman.service.js.map