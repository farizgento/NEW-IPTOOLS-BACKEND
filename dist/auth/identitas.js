"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PENYEDIA_IDENTITAS = exports.PenyediaDirektori = exports.PenyediaLewati = void 0;
/**
 * Menerima username apa pun tanpa memeriksa sandi.
 *
 * HANYA untuk pengembangan lokal. Konfigurasi menolak menyala bila ini aktif
 * saat NODE_ENV=production (lihat konfigurasi/konfigurasi.ts), sehingga tidak
 * bisa ikut terbawa ke lingkungan nyata karena kelalaian.
 */
class PenyediaLewati {
    nama = 'lewati-direktori';
    async periksa(username) {
        return username.trim().length > 0;
    }
}
exports.PenyediaLewati = PenyediaLewati;
/**
 * Penerapan direktori. Belum aktif: alamat server dan akun uji belum tersedia.
 *
 * Catatan untuk penerapannya nanti — dua cacat sistem lama yang tidak boleh
 * ikut terbawa:
 *   1. Filter pencarian dirangkai dari username mentah, sehingga terbuka
 *      terhadap penyisipan LDAP. Nilai apa pun dari pengguna wajib di-escape.
 *   2. Ada sandi utama yang membuat siapa pun bisa masuk sebagai siapa pun.
 *      Tidak boleh ada jalan pintas semacam itu.
 *
 * Saat mengaktifkannya, sekalian baca atribut `department` dan `title` dari
 * direktori — keduanya dapat mengisi unit dan jabatan tanpa menunggu akses
 * basis data kepegawaian (PRD 6.2.1 sumber 1).
 */
class PenyediaDirektori {
    nama = 'direktori';
    async periksa() {
        throw new Error('Penyedia direktori belum dikonfigurasi. ' +
            'Untuk pengembangan lokal, setel AUTH_LEWATI_DIREKTORI=true.');
    }
}
exports.PenyediaDirektori = PenyediaDirektori;
exports.PENYEDIA_IDENTITAS = Symbol('PENYEDIA_IDENTITAS');
//# sourceMappingURL=identitas.js.map