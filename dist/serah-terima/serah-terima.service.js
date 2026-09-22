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
var SerahTerimaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SerahTerimaService = void 0;
const common_1 = require("@nestjs/common");
const konfigurasi_1 = require("../konfigurasi/konfigurasi");
const serah_terima_repository_1 = require("./serah-terima.repository");
const pengguna_repository_1 = require("../pengguna/pengguna.repository");
const notifikasi_repository_1 = require("../notifikasi/notifikasi.repository");
const penilaian_1 = require("../penilaian/penilaian");
const konfirmasi_1 = require("./konfirmasi");
let SerahTerimaService = SerahTerimaService_1 = class SerahTerimaService {
    repo;
    pengguna;
    notifikasi;
    konf;
    log = new common_1.Logger(SerahTerimaService_1.name);
    constructor(repo, pengguna, notifikasi, konf) {
        this.repo = repo;
        this.pengguna = pengguna;
        this.notifikasi = notifikasi;
        this.konf = konf;
    }
    /** Daftar kerja petugas gudang: siap diserahkan, draf, dan menunggu konfirmasi. */
    async antreanPetugas(pengguna) {
        if (!this.adalahPengelola(pengguna)) {
            throw new common_1.ForbiddenException('Hanya pengelola alat yang dapat melihat daftar serah terima');
        }
        if (pengguna.unitId === null) {
            return { siap: [], draf: [], menunggu: [], catatan: 'Unit Anda belum tercatat, sehingga daftar gudang tidak dapat ditentukan.' };
        }
        return { ...(await this.repo.antreanPetugas(pengguna.unitId)), catatan: null };
    }
    /** Bahan layar penyiapan satu pengajuan (PRD F7). */
    async persiapan(peminjamanId, pengguna) {
        if (!this.adalahPengelola(pengguna)) {
            throw new common_1.ForbiddenException('Hanya pengelola alat yang dapat menyiapkan serah terima');
        }
        if (pengguna.unitId === null)
            throw new common_1.ForbiddenException('Unit Anda belum tercatat');
        const data = await this.repo.persiapan(peminjamanId, pengguna.unitId);
        if (!data)
            throw new common_1.NotFoundException(`Pengajuan #${peminjamanId} tidak ditemukan`);
        if (!['APPROVED', 'PARTIAL SENT'].includes(data.pengajuan.status)) {
            throw new common_1.BadRequestException({
                code: 'BELUM_DISETUJUI',
                message: `Pengajuan ini berstatus ${data.pengajuan.status}; hanya pengajuan yang sudah disetujui yang dapat diserahkan`,
            });
        }
        const dinilai = await this.repo.alatDinilai(data.alat.map((x) => x.peminjamanAlatId), 'SENT', penilaian_1.JUMLAH_GRUP);
        // Varian "ambil di gudang" memakai serah terima ringkas (PRD 9.2.1).
        return {
            ...data,
            alat: data.alat.map((x) => ({ ...x, sudahDinilaiKirim: dinilai.has(x.peminjamanAlatId) })),
            ringkas: data.pengajuan.alur === 'DALAM_UNIT_GUDANG',
        };
    }
    adalahPengelola(pengguna) {
        return pengguna.peran.includes('PENGELOLA') || pengguna.peran.includes('STAF');
    }
    /** F7 — menyiapkan dokumen serah terima. */
    async siapkan(pengguna, permintaan) {
        if (!this.adalahPengelola(pengguna)) {
            throw new common_1.ForbiddenException('Hanya pengelola alat yang dapat menyiapkan serah terima');
        }
        if (!permintaan.peminjamanAlatIds.length) {
            throw new common_1.BadRequestException({
                code: 'ALAT_KOSONG',
                message: 'Pilih setidaknya satu alat untuk diserahkan',
            });
        }
        // Kedua arah: alat baru boleh masuk dokumen setelah penilaian kondisinya
        // lengkap — tahap SENT saat dikirim, RETURN saat dikembalikan (PRD F7, F11).
        const { tahap } = (0, konfirmasi_1.syaratPenilaian)(permintaan.arah, 0);
        const dinilai = await this.repo.alatDinilai(permintaan.peminjamanAlatIds, tahap, penilaian_1.JUMLAH_GRUP);
        const belum = (0, konfirmasi_1.alatBelumDinilai)(permintaan.peminjamanAlatIds, dinilai);
        if (belum.length) {
            const { code, message } = (0, konfirmasi_1.syaratPenilaian)(permintaan.arah, belum.length);
            throw new common_1.BadRequestException({ code, message, details: { peminjamanAlatIds: belum } });
        }
        const bentuk = permintaan.ringkas ? 'RINGKAS' : 'PENUH';
        const kode = (0, konfirmasi_1.buatKodeKonfirmasi)();
        const id = await this.repo.siapkan({
            peminjamanId: permintaan.peminjamanId,
            arah: permintaan.arah,
            bentuk,
            kodeKonfirmasi: kode,
            // Bentuk ringkas tidak memakai kendaraan: alat diambil sendiri di gudang.
            nomorKendaraan: bentuk === 'RINGKAS' ? null : (permintaan.nomorKendaraan ?? null),
            jenisKendaraan: bentuk === 'RINGKAS' ? null : (permintaan.jenisKendaraan ?? null),
            pengemudi: bentuk === 'RINGKAS' ? null : (permintaan.pengemudi ?? null),
            peminjamanAlatIds: permintaan.peminjamanAlatIds,
            dibuatOleh: pengguna.id,
            namaPembuat: pengguna.nama,
        });
        return {
            id,
            bentuk,
            // Ditampilkan sekali di sini agar dapat dicetak pada dokumen.
            kodeKonfirmasi: kode,
            alat: await this.repo.alat(id),
        };
    }
    /** F7 — menyerahkan alat. */
    async serahkan(pengguna, serahTerimaId) {
        if (!this.adalahPengelola(pengguna)) {
            throw new common_1.ForbiddenException('Hanya pengelola alat yang dapat menyerahkan alat');
        }
        const st = await this.repo.ambil(serahTerimaId);
        if (!st)
            throw new common_1.NotFoundException(`Serah terima #${serahTerimaId} tidak ditemukan`);
        if (st.status !== 'DRAFT') {
            throw new common_1.BadRequestException({
                code: 'SUDAH_DISERAHKAN',
                message: `Serah terima ini sudah berstatus ${st.status}`,
            });
        }
        const status = await this.repo.serahkan({
            serahTerimaId,
            peminjamanId: st.peminjamanId,
            arah: st.arah,
            oleh: pengguna.id,
            nama: pengguna.nama,
            hitungStatus: (jumlah, sudah) => (0, konfirmasi_1.statusSetelahSerah)(jumlah, sudah, st.arah),
        });
        this.log.log(`Serah terima #${serahTerimaId} diserahkan oleh ${pengguna.nama} → ${status}`);
        // Tautan sekali-ketuk dikirim ke peminjam (PRD F8 jalur 1). Dikerjakan
        // sesudah transaksi ditutup: kegagalan notifikasi tidak boleh membatalkan
        // penyerahan (CLAUDE.md, Arsitektur backend).
        const tautan = st.peminjamId && st.arah === 'KIRIM'
            ? (0, konfirmasi_1.alamatTautan)(this.konf.WEB_URL, (0, konfirmasi_1.buatTautan)({ serahTerimaId, penerimaId: st.peminjamId }, this.konf.JWT_RAHASIA))
            : null;
        if (tautan)
            await this.kirimTautan(st.peminjamId, st.peminjamanId, serahTerimaId, st.jumlahAlat, tautan);
        // Tautan hanya dikembalikan pada pengembangan lokal untuk pengujian. Di
        // produksi petugas tidak boleh memegangnya: dengan tautan itu ia dapat
        // "mengonfirmasi" atas nama peminjam tanpa tercatat sebagai petugas.
        return { status, ...(this.konf.AUTH_LEWATI_DIREKTORI && tautan ? { tautanUji: tautan } : {}) };
    }
    async kirimTautan(penerimaId, peminjamanId, serahTerimaId, jumlahAlat, tautan) {
        try {
            const penerima = await this.pengguna.cariLewatId(penerimaId);
            await this.notifikasi.antrekan({
                penerimaId,
                penerimaEmail: penerima?.email ?? null,
                kanal: 'SUREL',
                perihal: '[DISERAHKAN] Konfirmasi penerimaan alat',
                isi: `${penerima?.nama ?? 'Peminjam'}, ${jumlahAlat} alat pada peminjaman #${peminjamanId} sudah diserahkan. ` +
                    'Cocokkan kode pada label alat, lalu tekan tautan berikut untuk mengonfirmasi penerimaan.',
                tautan,
                entitas: 'SERAH_TERIMA',
                entitasId: serahTerimaId,
            });
        }
        catch (e) {
            this.log.warn(`Notifikasi tautan untuk serah terima #${serahTerimaId} gagal diantrekan: ${e.message}`);
        }
    }
    /** Halaman tautan tanpa login (PRD F8 jalur 1): hanya serah terima yang tertulis di tautan. */
    async berkasTautan(token) {
        const isi = this.bacaTautanSah(token);
        const st = await this.repo.ambil(isi.serahTerimaId);
        if (!st || st.peminjamId !== isi.penerimaId)
            throw new common_1.NotFoundException('Serah terima tidak ditemukan');
        const penerima = await this.pengguna.cariLewatId(isi.penerimaId);
        return {
            serahTerima: { id: st.id, peminjamanId: st.peminjamanId, arah: st.arah, status: st.status, pekerjaan: st.pekerjaan, jumlahAlat: st.jumlahAlat, belumDikonfirmasi: st.belumDikonfirmasi, diserahkanPada: st.diserahkanPada },
            penerima: penerima?.nama ?? st.peminjam,
            alat: await this.repo.alat(st.id),
            kedaluwarsa: new Date(isi.kedaluwarsa).toISOString(),
        };
    }
    /** Konfirmasi dari halaman tautan: penerimanya diambil dari tautan, bukan dari sesi. */
    async konfirmasiTautan(token, masukan) {
        const isi = this.bacaTautanSah(token);
        const penerima = await this.pengguna.cariLewatId(isi.penerimaId);
        if (!penerima)
            throw new common_1.ForbiddenException('Penerima tautan tidak dikenali');
        return this.konfirmasi(isi.serahTerimaId, penerima, { metode: 'TAUTAN', tautan: token, ...masukan });
    }
    bacaTautanSah(token) {
        const hasil = (0, konfirmasi_1.bacaTautan)(token, this.konf.JWT_RAHASIA);
        if (!hasil.sah || !hasil.isi)
            throw new common_1.ForbiddenException(hasil.alasan ?? 'Tautan tidak sah');
        return hasil.isi;
    }
    /** F9 — daftar serah terima yang menunggu konfirmasi pengguna ini. */
    async menungguKonfirmasi(pengguna) {
        const daftar = await this.repo.menungguKonfirmasi(pengguna.id);
        return {
            jumlah: daftar.length,
            isi: daftar.map((d) => ({
                ...d,
                // Umur pengiriman ditandai agar yang tertinggal tidak tenggelam.
                penanda: d.umurHari > 7 ? 'terlambat' : d.umurHari > 3 ? 'tertunda' : 'biasa',
            })),
        };
    }
    async berkas(serahTerimaId, pengguna) {
        const st = await this.repo.ambil(serahTerimaId);
        if (!st)
            throw new common_1.NotFoundException(`Serah terima #${serahTerimaId} tidak ditemukan`);
        const miliknya = st.peminjamId === pengguna.id;
        if (!miliknya && !this.adalahPengelola(pengguna)) {
            throw new common_1.ForbiddenException('Serah terima ini bukan milik Anda');
        }
        return {
            serahTerima: st,
            // Kode hanya untuk petugas, agar dokumen dapat dicetak ulang. Peminjam
            // memperolehnya dari dokumen fisik; menampilkannya di layarnya sendiri
            // akan mengosongkan arti jalur kode.
            kodeKonfirmasi: this.adalahPengelola(pengguna) ? (await this.repo.kodeKonfirmasi(serahTerimaId)).kode : null,
            alat: await this.repo.alat(serahTerimaId),
            // Dinyatakan terus terang agar pengguna tidak mengira prosesnya tuntas
            // padahal masih ada alat yang belum dikonfirmasi (PRD F9).
            catatan: st.belumDikonfirmasi > 0
                ? `Status peminjaman baru berubah setelah seluruh ${st.jumlahAlat} alat dikonfirmasi. ` +
                    `Saat ini ${st.belumDikonfirmasi} belum.`
                : 'Seluruh alat pada serah terima ini sudah dikonfirmasi.',
        };
    }
    /** F8 + F9 — mengonfirmasi penerimaan lewat salah satu dari empat jalur. */
    async konfirmasi(serahTerimaId, pengguna, permintaan) {
        const st = await this.repo.ambil(serahTerimaId);
        if (!st)
            throw new common_1.NotFoundException(`Serah terima #${serahTerimaId} tidak ditemukan`);
        if (st.status === 'SELESAI') {
            throw new common_1.BadRequestException({
                code: 'SUDAH_DIKONFIRMASI',
                message: 'Seluruh alat pada serah terima ini sudah dikonfirmasi',
            });
        }
        if (!['SENT', 'RETURN'].includes(st.status)) {
            throw new common_1.BadRequestException({
                code: 'BELUM_DISERAHKAN',
                message: `Serah terima ini masih berstatus ${st.status}, alatnya belum diserahkan`,
            });
        }
        const pengelola = this.adalahPengelola(pengguna);
        const izin = (0, konfirmasi_1.periksaMetode)(permintaan.metode, pengelola, permintaan.alasan);
        if (!izin.boleh)
            throw new common_1.ForbiddenException(izin.alasan);
        // Peminjam hanya boleh mengonfirmasi miliknya sendiri.
        if (!pengelola && st.peminjamId !== pengguna.id) {
            throw new common_1.ForbiddenException('Serah terima ini bukan milik Anda');
        }
        if (permintaan.metode === 'KODE') {
            await this.periksaKode(serahTerimaId, permintaan.kode);
        }
        if (permintaan.metode === 'TAUTAN') {
            this.periksaTautan(serahTerimaId, pengguna.id, permintaan.tautan);
        }
        // Bawaannya: seluruh alat yang belum dikonfirmasi. Kasus lazimnya adalah
        // semuanya tiba bersamaan (PRD F9).
        const semua = await this.repo.alat(serahTerimaId);
        const belum = semua
            .filter((a) => a.DIKONFIRMASI_PADA === null)
            .map((a) => Number(a.ID));
        const dipilih = permintaan.serahTerimaAlatIds?.length
            ? permintaan.serahTerimaAlatIds.filter((id) => belum.includes(id))
            : belum;
        if (!dipilih.length) {
            throw new common_1.BadRequestException({
                code: 'TIDAK_ADA_YANG_DIKONFIRMASI',
                message: 'Tidak ada alat yang menunggu konfirmasi pada serah terima ini',
            });
        }
        const hasil = await this.repo.konfirmasi({
            serahTerimaId,
            peminjamanId: st.peminjamanId,
            serahTerimaAlatIds: dipilih,
            metode: permintaan.metode,
            alasan: permintaan.alasan?.trim() ?? null,
            oleh: pengguna.id,
            nama: pengguna.nama,
            arah: st.arah,
            statusLama: st.status === 'SENT' ? 'SENT' : 'RETURN',
            hitungStatus: (jumlah, sudah) => (0, konfirmasi_1.statusSetelahTerima)(jumlah, sudah, st.arah),
            belumDiterima: (permintaan.belumDiterima ?? []).filter((b) => belum.includes(b.serahTerimaAlatId) && !dipilih.includes(b.serahTerimaAlatId)),
        });
        this.log.log(`Serah terima #${serahTerimaId}: ${hasil.dikonfirmasi} alat dikonfirmasi ` +
            `(${permintaan.metode}) oleh ${pengguna.nama} → ${hasil.status}`);
        return {
            ...hasil,
            catatan: hasil.sisa > 0
                ? `Masih ada ${hasil.sisa} alat yang belum dikonfirmasi. ` +
                    'Status peminjaman baru menjadi diterima penuh setelah seluruhnya dikonfirmasi.'
                : 'Seluruh alat sudah dikonfirmasi.',
        };
    }
    async periksaKode(serahTerimaId, kode) {
        if (!kode?.trim()) {
            throw new common_1.BadRequestException({ code: 'KODE_KOSONG', message: 'Kode konfirmasi wajib diisi' });
        }
        const tersimpan = await this.repo.kodeKonfirmasi(serahTerimaId);
        if (tersimpan.percobaan >= konfirmasi_1.BATAS_PERCOBAAN_KODE) {
            throw new common_1.ForbiddenException('Percobaan kode sudah terlalu banyak. Hubungi pengelola alat untuk konfirmasi.');
        }
        if (!(0, konfirmasi_1.kodeCocok)(kode, tersimpan.kode)) {
            await this.repo.catatPercobaanKode(serahTerimaId);
            throw new common_1.BadRequestException({
                code: 'KODE_SALAH',
                message: 'Kode konfirmasi tidak cocok',
                details: { sisaPercobaan: konfirmasi_1.BATAS_PERCOBAAN_KODE - tersimpan.percobaan - 1 },
            });
        }
    }
    periksaTautan(serahTerimaId, penggunaId, tautan) {
        if (!tautan) {
            throw new common_1.BadRequestException({ code: 'TAUTAN_KOSONG', message: 'Tautan tidak disertakan' });
        }
        const hasil = (0, konfirmasi_1.bacaTautan)(tautan, this.konf.JWT_RAHASIA);
        if (!hasil.sah || !hasil.isi) {
            throw new common_1.ForbiddenException(hasil.alasan ?? 'Tautan tidak sah');
        }
        // Tautan terikat satu serah terima dan satu penerima.
        if (hasil.isi.serahTerimaId !== serahTerimaId || hasil.isi.penerimaId !== penggunaId) {
            throw new common_1.ForbiddenException('Tautan ini bukan untuk serah terima atau penerima ini');
        }
    }
};
exports.SerahTerimaService = SerahTerimaService;
exports.SerahTerimaService = SerahTerimaService = SerahTerimaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)(konfigurasi_1.KONFIGURASI)),
    __metadata("design:paramtypes", [serah_terima_repository_1.SerahTerimaRepository,
        pengguna_repository_1.PenggunaRepository,
        notifikasi_repository_1.NotifikasiRepository, Object])
], SerahTerimaService);
//# sourceMappingURL=serah-terima.service.js.map