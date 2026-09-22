"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PENGIRIM_NOTIFIKASI = exports.PengirimSurel = exports.PengirimPencatat = void 0;
const common_1 = require("@nestjs/common");
/**
 * Penerapan sementara: pesan dicatat, tidak dikirim.
 *
 * Dipilih dengan sengaja daripada membiarkan pengiriman gagal diam-diam.
 * Barisnya tetap ditandai terkirim agar jenjang pengingat berikutnya berjalan
 * dan dapat diuji, dan lognya menyatakan terus terang bahwa tidak ada surel
 * yang benar-benar keluar.
 */
class PengirimPencatat {
    nama = 'pencatat';
    log = new common_1.Logger('Notifikasi');
    async kirim(pesan) {
        this.log.log(`[TIDAK DIKIRIM — penerapan pencatat] ${pesan.kanal} ke ` +
            `${pesan.penerimaEmail ?? '(tanpa alamat)'}: ${pesan.perihal}`);
    }
}
exports.PengirimPencatat = PengirimPencatat;
/**
 * Penerapan surel. Belum aktif: alamat server SMTP belum tersedia.
 *
 * Catatan untuk penerapannya nanti — satu cacat sistem lama yang tidak boleh
 * ikut terbawa: `SEND_MAIL` memanggil `UTL_SMTP` tanpa penangan exception,
 * sehingga kegagalan pengiriman membatalkan pelaporan transaksi bisnis yang
 * sudah selesai. Di sini pengiriman berada di luar transaksi bisnis dan
 * kegagalannya hanya mencatat, tidak pernah membatalkan apa pun.
 */
class PengirimSurel {
    nama = 'surel';
    async kirim() {
        throw new Error('Pengirim surel belum dikonfigurasi (SMTP_HOST belum diisi)');
    }
}
exports.PengirimSurel = PengirimSurel;
exports.PENGIRIM_NOTIFIKASI = Symbol('PENGIRIM_NOTIFIKASI');
//# sourceMappingURL=pengirim.js.map