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
var LampiranService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LampiranService = void 0;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const common_1 = require("@nestjs/common");
const konfigurasi_1 = require("../konfigurasi/konfigurasi");
const lampiran_repository_1 = require("./lampiran.repository");
const berkas_1 = require("./berkas");
let LampiranService = LampiranService_1 = class LampiranService {
    repo;
    konf;
    log = new common_1.Logger(LampiranService_1.name);
    constructor(repo, konf) {
        this.repo = repo;
        this.konf = konf;
    }
    akar() {
        return (0, node_path_1.resolve)(this.konf.LAMPIRAN_DIREKTORI);
    }
    /**
     * Menyusun lokasi berkas dan memastikan hasilnya tetap di dalam direktori
     * penyimpanan.
     *
     * Pemeriksaan ini berlapis dengan `namaSimpan` yang sudah membuang nama dari
     * pengunggah: kalau kelak ada jalur lain yang memasok nama, berkas tetap
     * tidak bisa keluar dari direktorinya.
     */
    lokasiPenuh(relatif) {
        const akar = this.akar();
        const penuh = (0, node_path_1.resolve)(akar, (0, node_path_1.normalize)(relatif));
        if (penuh !== akar && !penuh.startsWith(akar + node_path_1.sep)) {
            throw new common_1.BadRequestException({
                code: 'LOKASI_TIDAK_SAH',
                message: 'Lokasi berkas keluar dari direktori penyimpanan',
            });
        }
        return penuh;
    }
    /** Menolak pengguna tanpa hak atas berkas master data alat. */
    pastikanBoleh(entitas, jenis, tipeMedia, pengguna) {
        const tolak = (0, berkas_1.periksaTujuan)(entitas, jenis, tipeMedia, pengguna.peran);
        if (!tolak)
            return;
        if (tolak.kode === 'PERAN')
            throw new common_1.ForbiddenException({ code: 'BUKAN_WEWENANG', message: tolak.pesan });
        throw new common_1.BadRequestException({ code: 'BERKAS_DITOLAK', message: tolak.pesan });
    }
    async unggah(pengguna, entitas, entitasId, jenis, berkas) {
        this.pastikanBoleh(entitas, jenis, berkas.mimetype, pengguna);
        if (!(await this.repo.entitasAda(entitas, entitasId))) {
            throw new common_1.NotFoundException({ code: 'TUJUAN_TIDAK_ADA', message: `${entitas} #${entitasId} tidak ditemukan` });
        }
        const pelanggaran = (0, berkas_1.validasiBerkas)({
            namaAsli: berkas.originalname,
            tipeMedia: berkas.mimetype,
            ukuran: berkas.size,
        }, this.konf.LAMPIRAN_MAKS_BITA);
        if (!(0, berkas_1.akhiranCocok)(berkas.originalname, berkas.mimetype)) {
            pelanggaran.push({
                field: 'berkas',
                message: 'Akhiran nama berkas tidak sesuai dengan tipe isinya',
            });
        }
        if (!pelanggaran.length && !(0, berkas_1.isiCocok)(berkas.buffer.subarray(0, 16), berkas.mimetype)) {
            pelanggaran.push({ field: 'berkas', message: 'Isi berkas tidak sesuai dengan tipenya' });
        }
        if (pelanggaran.length) {
            throw new common_1.BadRequestException({
                code: 'BERKAS_DITOLAK',
                message: 'Berkas tidak dapat diterima',
                details: pelanggaran,
            });
        }
        const nama = (0, berkas_1.namaSimpan)(berkas.mimetype);
        const relatif = (0, berkas_1.lokasiRelatif)(entitas, entitasId, nama);
        const penuh = this.lokasiPenuh(relatif);
        await (0, promises_1.mkdir)((0, node_path_1.dirname)(penuh), { recursive: true });
        await (0, promises_1.writeFile)(penuh, berkas.buffer);
        try {
            const id = await this.repo.simpan({
                entitas,
                entitasId,
                jenis,
                namaBerkas: (0, berkas_1.bersihkanNamaAsli)(berkas.originalname),
                lokasi: relatif,
                tipeMedia: berkas.mimetype,
                ukuranBita: berkas.size,
                diunggahOleh: pengguna.id,
            });
            this.log.log(`Lampiran #${id} (${entitas}/${entitasId}) diunggah oleh ${pengguna.nama}`);
            const tersimpan = await this.repo.ambil(id);
            return tersimpan;
        }
        catch (galat) {
            // Baris gagal disimpan: berkasnya ikut dibuang agar tidak menjadi sampah
            // yang tidak tercatat di mana pun.
            await (0, promises_1.unlink)(penuh).catch(() => undefined);
            throw galat;
        }
    }
    async daftar(entitas, entitasId) {
        return this.repo.daftar(entitas, entitasId);
    }
    /**
     * Menyiapkan berkas untuk diunduh.
     *
     * Baris hasil migrasi hanya memuat nama berkas tanpa lokasi — berkas fisiknya
     * ada di penyimpanan sistem lama. Baris seperti itu ditandai, bukan
     * dilaporkan sebagai kesalahan tak dikenal.
     */
    async berkasUntukUnduh(id) {
        const lampiran = await this.repo.ambil(id);
        if (!lampiran)
            throw new common_1.NotFoundException(`Lampiran #${id} tidak ditemukan`);
        if (!lampiran.lokasi) {
            throw new common_1.NotFoundException({
                code: 'BERKAS_SISTEM_LAMA',
                message: 'Berkas ini tercatat pada sistem lama dan fisiknya belum dipindahkan. ' +
                    `Nama berkasnya: ${lampiran.namaBerkas}`,
            });
        }
        const penuh = this.lokasiPenuh(lampiran.lokasi);
        try {
            await (0, promises_1.stat)(penuh);
        }
        catch {
            await this.repo.tandaiHilang(id);
            throw new common_1.NotFoundException({
                code: 'BERKAS_HILANG',
                message: 'Berkas tercatat tetapi tidak ditemukan di penyimpanan',
            });
        }
        return { lampiran, lokasiPenuh: penuh };
    }
    async hapus(pengguna, id) {
        const lampiran = await this.repo.ambil(id);
        if (!lampiran)
            throw new common_1.NotFoundException(`Lampiran #${id} tidak ditemukan`);
        // Hanya wewenang yang diperiksa: jenis lama hasil migrasi tetap boleh dihapus.
        if ((0, berkas_1.periksaTujuan)(lampiran.entitas, lampiran.jenis, null, pengguna.peran)?.kode === 'PERAN') {
            this.pastikanBoleh(lampiran.entitas, lampiran.jenis, null, pengguna);
        }
        await this.repo.hapus(id);
        if (lampiran.lokasi) {
            await (0, promises_1.unlink)(this.lokasiPenuh(lampiran.lokasi)).catch(() => undefined);
        }
    }
    /** Menjadikan sebuah foto alat sebagai foto utama (yang tampil di katalog). */
    async jadikanUtama(pengguna, id) {
        const lampiran = await this.repo.ambil(id);
        if (!lampiran)
            throw new common_1.NotFoundException(`Lampiran #${id} tidak ditemukan`);
        if (lampiran.entitas !== 'ALAT' || lampiran.jenis !== 'GAMBAR') {
            throw new common_1.BadRequestException({ code: 'BUKAN_FOTO_ALAT', message: 'Hanya foto alat yang dapat dijadikan foto utama' });
        }
        this.pastikanBoleh(lampiran.entitas, lampiran.jenis, null, pengguna);
        await this.repo.jadikanPertama(id);
        return (await this.repo.ambil(id));
    }
    /** Dipakai saat menyalakan aplikasi, agar kegagalan izin tulis segera terlihat. */
    async siapkanDirektori() {
        await (0, promises_1.mkdir)((0, node_path_1.join)(this.akar()), { recursive: true });
    }
};
exports.LampiranService = LampiranService;
exports.LampiranService = LampiranService = LampiranService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(konfigurasi_1.KONFIGURASI)),
    __metadata("design:paramtypes", [lampiran_repository_1.LampiranRepository, Object])
], LampiranService);
//# sourceMappingURL=lampiran.service.js.map