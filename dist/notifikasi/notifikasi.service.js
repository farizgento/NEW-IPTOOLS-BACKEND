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
var NotifikasiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotifikasiService = void 0;
const common_1 = require("@nestjs/common");
const konfigurasi_1 = require("../konfigurasi/konfigurasi");
const konfirmasi_1 = require("../serah-terima/konfirmasi");
const notifikasi_repository_1 = require("./notifikasi.repository");
const pengirim_1 = require("./pengirim");
const pengingat_1 = require("./pengingat");
let NotifikasiService = NotifikasiService_1 = class NotifikasiService {
    repo;
    pengirim;
    konf;
    log = new common_1.Logger(NotifikasiService_1.name);
    pewaktu;
    constructor(repo, pengirim, konf) {
        this.repo = repo;
        this.pengirim = pengirim;
        this.konf = konf;
    }
    onModuleInit() {
        if (!this.konf.PENGINGAT_AKTIF) {
            this.log.log('Penjadwal pengingat tidak aktif (PENGINGAT_AKTIF=false)');
            return;
        }
        const jeda = this.konf.PENGINGAT_JEDA_MENIT * 60_000;
        this.pewaktu = setInterval(() => {
            void this.putaran().catch((galat) => {
                // Kegagalan penjadwal tidak boleh menjatuhkan aplikasi.
                this.log.error(`Putaran pengingat gagal: ${String(galat)}`);
            });
        }, jeda);
        // Membiarkan proses berhenti meski pewaktu masih terpasang.
        this.pewaktu.unref();
        this.log.log(`Penjadwal pengingat aktif, setiap ${this.konf.PENGINGAT_JEDA_MENIT} menit`);
    }
    onModuleDestroy() {
        if (this.pewaktu)
            clearInterval(this.pewaktu);
    }
    /** Satu putaran: memeriksa yang jatuh tempo, lalu mengirim yang mengantre. */
    async putaran() {
        const pemeriksaan = await this.periksa();
        const dikirim = await this.kirimAntrean();
        return { pemeriksaan, dikirim };
    }
    /**
     * Memeriksa apa yang sudah jatuh tempo dan mengantrekan pengingatnya.
     *
     * Pemeriksaan dan pengiriman sengaja dipisah: kalau pengiriman gagal, yang
     * sudah diantrekan tetap tercatat dan dicoba lagi pada putaran berikutnya.
     */
    async periksa(sekarang = new Date()) {
        const rincian = [];
        let diperiksa = 0;
        for (const calon of await this.repo.calonKonfirmasi()) {
            diperiksa += 1;
            const jenjang = (0, pengingat_1.jenjangJatuhTempo)(calon.diserahkanPada, sekarang, calon.sudahDikirim);
            if (!jenjang)
                continue;
            const umurHari = (0, pengingat_1.selisihHari)(calon.diserahkanPada, sekarang);
            const tautan = calon.penerimaId === null
                ? null
                : (0, konfirmasi_1.buatTautan)({ serahTerimaId: calon.serahTerimaId, penerimaId: calon.penerimaId }, this.konf.JWT_RAHASIA);
            await this.repo.antrekan({
                penerimaId: calon.penerimaId,
                penerimaEmail: calon.penerimaEmail,
                kanal: 'SUREL',
                // Jenjang ditulis di perihal agar putaran berikutnya tahu mana yang
                // sudah pernah dikirim, tanpa tabel tambahan.
                perihal: `[${jenjang.jenjang}] ${jenjang.perihal}`,
                isi: (0, pengingat_1.susunPesan)({
                    jenjang: jenjang.jenjang,
                    namaPenerima: calon.namaPenerima,
                    jumlahAlat: calon.jumlahBelum,
                    nomorPeminjaman: calon.peminjamanId,
                    umurHari,
                }),
                tautan,
                entitas: 'SERAH_TERIMA',
                entitasId: calon.serahTerimaId,
            });
            rincian.push({
                entitas: 'SERAH_TERIMA',
                entitasId: calon.serahTerimaId,
                jenjang: jenjang.jenjang,
            });
        }
        for (const calon of await this.repo.calonPengembalian()) {
            diperiksa += 1;
            const jenjang = (0, pengingat_1.pengingatPengembalian)(calon.tanggalSelesai, sekarang, calon.sudahDikirim);
            if (!jenjang)
                continue;
            await this.repo.antrekan({
                penerimaId: calon.penerimaId,
                penerimaEmail: calon.penerimaEmail,
                kanal: 'SUREL',
                perihal: `[${jenjang.jenjang}] ${jenjang.perihal}`,
                isi: (0, pengingat_1.susunPesan)({
                    jenjang: jenjang.jenjang,
                    namaPenerima: calon.namaPenerima,
                    jumlahAlat: calon.jumlahAlat,
                    nomorPeminjaman: calon.peminjamanId,
                    umurHari: 0,
                }),
                tautan: null,
                entitas: 'PEMINJAMAN',
                entitasId: calon.peminjamanId,
            });
            rincian.push({
                entitas: 'PEMINJAMAN',
                entitasId: calon.peminjamanId,
                jenjang: jenjang.jenjang,
            });
        }
        return { diperiksa, diantrekan: rincian.length, rincian };
    }
    async kirimAntrean() {
        const antrean = await this.repo.siapKirim();
        let berhasil = 0;
        for (const n of antrean) {
            const id = Number(n.ID);
            try {
                await this.pengirim.kirim({
                    penerimaEmail: n.PENERIMA_EMAIL ?? null,
                    kanal: n.KANAL,
                    perihal: n.PERIHAL,
                    isi: n.ISI,
                    tautan: n.TAUTAN ?? null,
                });
                await this.repo.tandaiTerkirim(id);
                berhasil += 1;
            }
            catch (galat) {
                // Kegagalan satu notifikasi tidak menghentikan sisanya.
                await this.repo.tandaiGagal(id, galat instanceof Error ? galat.message : String(galat));
            }
        }
        return berhasil;
    }
    ringkasan() {
        return this.repo.ringkasan();
    }
};
exports.NotifikasiService = NotifikasiService;
exports.NotifikasiService = NotifikasiService = NotifikasiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(pengirim_1.PENGIRIM_NOTIFIKASI)),
    __param(2, (0, common_1.Inject)(konfigurasi_1.KONFIGURASI)),
    __metadata("design:paramtypes", [notifikasi_repository_1.NotifikasiRepository, Object, Object])
], NotifikasiService);
//# sourceMappingURL=notifikasi.service.js.map