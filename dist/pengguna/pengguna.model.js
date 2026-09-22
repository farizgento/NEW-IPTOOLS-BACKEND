"use strict";
/**
 * Bentuk data pengguna di lapisan aplikasi.
 *
 * Berkas ini sengaja tanpa dekorator dan tanpa ketergantungan pada Nest maupun
 * Oracle, supaya aturannya dapat diuji sebagai fungsi biasa.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERAN = void 0;
exports.kePengguna = kePengguna;
exports.punyaSalahSatuPeran = punyaSalahSatuPeran;
exports.bolehMasuk = bolehMasuk;
exports.PERAN = [
    'PEMINJAM',
    'PENGELOLA',
    'MANAJER',
    'GM',
    'STAF',
    'ADMIN_UNIT',
    'ADMIN_SUPER',
];
function bacaPeran(gabungan) {
    if (!gabungan)
        return [];
    const sah = new Set(exports.PERAN);
    return gabungan
        .split(',')
        .map((p) => p.trim())
        .filter((p) => sah.has(p));
}
/**
 * Mengubah satu baris basis data menjadi objek pengguna.
 *
 * Baris yang ditandai `duplikat_dari` adalah salinan hasil pencatatan berulang
 * di sistem lama (PRD 7.3). Baris seperti itu tetap ada demi riwayat, tetapi
 * tidak pernah dianggap aktif.
 */
function kePengguna(baris) {
    return {
        id: Number(baris.ID),
        nama: baris.NAMA,
        email: baris.EMAIL,
        username: baris.USERNAME,
        nipeg: baris.NIPEG,
        unitId: baris.UNIT_ID === null ? null : Number(baris.UNIT_ID),
        namaUnit: baris.NAMA_UNIT,
        jabatan: baris.JABATAN,
        sumberUnit: baris.SUMBER_UNIT ?? null,
        aktif: baris.DUPLIKAT_DARI === null && baris.NONAKTIF_PADA === null,
        peran: bacaPeran(baris.PERAN),
    };
}
/** Benar bila pengguna memegang salah satu peran yang diminta. */
function punyaSalahSatuPeran(pengguna, diminta) {
    if (diminta.length === 0)
        return true;
    return diminta.some((p) => pengguna.peran.includes(p));
}
/**
 * Pengguna boleh masuk bila barisnya aktif. Peran tidak diperiksa di sini —
 * pengguna tanpa peran pun berhak melihat profilnya sendiri.
 */
function bolehMasuk(pengguna) {
    return pengguna.aktif;
}
//# sourceMappingURL=pengguna.model.js.map