"use strict";
/**
 * Pengingat berjenjang (PRD F12).
 *
 * Menyerang jeda yang paling mahal di data produksi: median 344 jam (14,3 hari)
 * dari alat dikirim sampai dikonfirmasi diterima, dengan 62,7% lewat sepekan.
 *
 * Sistem lama mengirim satu notifikasi saat alat diserahkan, lalu diam. Tidak
 * ada catatan apakah notifikasi itu sampai, dan tidak ada pengingat susulan.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.JENJANG_KONFIRMASI = void 0;
exports.selisihHari = selisihHari;
exports.jenjangJatuhTempo = jenjangJatuhTempo;
exports.pengingatPengembalian = pengingatPengembalian;
exports.susunPesan = susunPesan;
/** Pengingat konfirmasi penerimaan, dihitung sejak alat diserahkan. */
exports.JENJANG_KONFIRMASI = [
    { jenjang: 'H1', setelahHari: 1, perihal: 'Konfirmasi penerimaan alat' },
    { jenjang: 'H3', setelahHari: 3, perihal: 'Alat Anda belum dikonfirmasi (3 hari)' },
    { jenjang: 'H7', setelahHari: 7, perihal: 'Alat Anda belum dikonfirmasi (sepekan)' },
];
const HARI = 86_400_000;
function selisihHari(dari, sampai) {
    return Math.floor((sampai.getTime() - dari.getTime()) / HARI);
}
/**
 * Jenjang yang sudah jatuh tempo tetapi belum pernah dikirim.
 *
 * Hanya jenjang tertinggi yang dikirim, bukan semuanya sekaligus: kalau sebuah
 * pengiriman baru diperiksa setelah sepuluh hari, penerimanya cukup mendapat
 * satu pesan, bukan tiga sekaligus.
 *
 * Jenjang yang lebih rendah dari yang sudah pernah dikirim tidak akan menyusul
 * kemudian. Tanpa aturan itu, pengiriman yang sudah menerima H7 akan menerima
 * H3 pada pemeriksaan berikutnya dan H1 sesudahnya — mundur, bukan mendesak.
 */
function jenjangJatuhTempo(diserahkanPada, sekarang, sudahDikirim, aturan = exports.JENJANG_KONFIRMASI) {
    const umur = selisihHari(diserahkanPada, sekarang);
    const tertinggiTerkirim = aturan
        .filter((a) => sudahDikirim.includes(a.jenjang))
        .reduce((tinggi, a) => Math.max(tinggi, a.setelahHari), -1);
    const belum = aturan.filter((a) => umur >= a.setelahHari &&
        a.setelahHari > tertinggiTerkirim &&
        !sudahDikirim.includes(a.jenjang));
    return belum.at(-1);
}
/**
 * Pengingat pengembalian: satu sebelum tanggal selesai, satu setelah lewat.
 *
 * Berbeda dari pengingat konfirmasi yang dihitung maju dari penyerahan, ini
 * dihitung terhadap tanggal selesai peminjaman.
 */
function pengingatPengembalian(tanggalSelesai, sekarang, sudahDikirim) {
    const sisa = selisihHari(sekarang, tanggalSelesai);
    if (sisa < 0 && !sudahDikirim.includes('TERLAMBAT')) {
        return {
            jenjang: 'TERLAMBAT',
            setelahHari: 0,
            perihal: `Alat terlambat dikembalikan (${Math.abs(sisa)} hari)`,
        };
    }
    if (sisa >= 0 && sisa <= 1 && !sudahDikirim.includes('JATUH_TEMPO')) {
        return {
            jenjang: 'JATUH_TEMPO',
            setelahHari: 0,
            perihal: 'Alat dijadwalkan kembali besok',
        };
    }
    return undefined;
}
/**
 * Isi pesan pengingat.
 *
 * Setiap pengingat memuat tautan langsung ke layar tindakannya — inilah yang
 * membedakannya dari notifikasi lama, yang memberi tahu tanpa mengarahkan ke
 * mana pun (PRD F12).
 */
function susunPesan(masukan) {
    const { jenjang, namaPenerima, jumlahAlat, nomorPeminjaman, umurHari } = masukan;
    if (jenjang === 'TERLAMBAT') {
        return (`${namaPenerima}, ${jumlahAlat} alat pada peminjaman #${nomorPeminjaman} ` +
            `sudah lewat tanggal pengembalian. Mohon segera dikembalikan.`);
    }
    if (jenjang === 'JATUH_TEMPO') {
        return (`${namaPenerima}, ${jumlahAlat} alat pada peminjaman #${nomorPeminjaman} ` +
            `dijadwalkan kembali besok.`);
    }
    const lama = umurHari === 1 ? 'kemarin' : `${umurHari} hari lalu`;
    return (`${namaPenerima}, ${jumlahAlat} alat pada peminjaman #${nomorPeminjaman} ` +
        `dikirim ${lama} dan belum Anda konfirmasi. ` +
        `Konfirmasi cukup satu ketukan lewat tautan di pesan ini.`);
}
//# sourceMappingURL=pengingat.js.map