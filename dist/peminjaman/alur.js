"use strict";
/**
 * Penentuan varian alur dan rantai approval (PRD 9.1).
 *
 * Fungsi murni tanpa ketergantungan pada Nest maupun Oracle, supaya aturannya
 * dapat diuji langsung — inilah bagian yang dulu tersembunyi di dalam procedure
 * dan tidak pernah bisa diuji sama sekali.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RANTAI = exports.STATUS_SELESAI = void 0;
exports.tentukanAlur = tentukanAlur;
exports.rantaiUntuk = rantaiUntuk;
exports.masihBerjalan = masihBerjalan;
/** Status pengajuan yang dianggap masih berjalan, sehingga alatnya terpakai. */
exports.STATUS_SELESAI = ['FINISH', 'PARTIAL FINISH', 'REJECT', 'REJECT PERPANJANGAN'];
/**
 * Rantai approval per varian, persis seperti SK:
 *   - dalam unit          : SP/SPS saja
 *   - antar unit/Area UJH : SP/SPS lalu Manajer
 *   - PLN Group/eksternal : SP/SPS, Manajer, lalu GM
 */
exports.RANTAI = {
    DALAM_UNIT: ['PENGELOLA'],
    DALAM_UNIT_GUDANG: ['PENGELOLA'],
    ANTAR_UNIT: ['PENGELOLA', 'MANAJER'],
    EKSTERNAL: ['PENGELOLA', 'MANAJER', 'GM'],
};
/**
 * Varian ditentukan sistem, bukan ditanyakan ke pengguna (PRD 9.1).
 *
 * Bila satu alat saja berasal dari unit lain, seluruh pengajuan diperlakukan
 * sebagai antar unit — tingkat approval mengikuti bagian yang paling menuntut.
 */
function tentukanAlur(masukan) {
    if (masukan.eksternal)
        return 'EKSTERNAL';
    const unitPeminjam = masukan.unitPeminjamId;
    // Unit pengaju belum diketahui, atau ada alat yang unitnya tidak tercatat.
    // Tidak boleh diperlakukan sebagai "dalam unit" hanya karena datanya kosong:
    // menganggapnya antar unit berarti meminta satu approval lebih banyak, dan
    // itu sisi yang aman untuk salah.
    if (unitPeminjam === null)
        return 'ANTAR_UNIT';
    if (masukan.unitAlatIds.some((u) => u === null))
        return 'ANTAR_UNIT';
    const semuaSatuUnit = masukan.unitAlatIds.every((u) => u === unitPeminjam);
    if (!semuaSatuUnit)
        return 'ANTAR_UNIT';
    return masukan.ambilDiGudang ? 'DALAM_UNIT_GUDANG' : 'DALAM_UNIT';
}
function rantaiUntuk(alur) {
    return exports.RANTAI[alur];
}
/** Benar bila pengajuan berstatus ini masih memakai alatnya. */
function masihBerjalan(status) {
    return !exports.STATUS_SELESAI.includes(status.toUpperCase());
}
//# sourceMappingURL=alur.js.map