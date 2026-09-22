"use strict";
/**
 * Aturan keputusan approval (PRD F5).
 *
 * Fungsi murni: seluruh aturan siapa boleh memutuskan apa, dan ke status mana
 * pengajuan berpindah, dapat diuji tanpa basis data. Di sistem lama aturan ini
 * tersebar di `ACTION_REQUEST_APPROVAL_SPTOOL`, `_SPTOOL2`, dan
 * `ACTION_REQUEST_APPROVAL_MGR`, dan tidak pernah bisa diuji sama sekali.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALASAN_SIAP_PAKAI = exports.PERAN_TAHAP = void 0;
exports.tahapBerjalan = tahapBerjalan;
exports.bolehMemutuskan = bolehMemutuskan;
exports.statusSetelahKeputusan = statusSetelahKeputusan;
exports.periksaAlasan = periksaAlasan;
/** Peran yang berhak memutuskan pada tiap tahap, sesuai SK. */
exports.PERAN_TAHAP = {
    PENGELOLA: ['PENGELOLA'],
    MANAJER: ['MANAJER'],
    GM: ['GM'],
};
/**
 * Tahap yang sedang menunggu keputusan: yang paling awal dan belum diputuskan.
 *
 * Rantai berjalan berurutan — manajer tidak boleh mendahului pengelola, karena
 * SK menempatkan review SP/SPS lebih dulu.
 */
function tahapBerjalan(rantai) {
    return [...rantai]
        .sort((a, b) => a.urutan - b.urutan)
        .find((baris) => baris.keputusan === 'MENUNGGU');
}
/**
 * Memeriksa apakah seseorang berhak memutuskan pengajuan ini sekarang.
 *
 * Empat hal diperiksa, dan seluruhnya di server. Antarmuka boleh dilewati.
 */
function bolehMemutuskan(rantai, peranPengguna, statusPengajuan) {
    if (['REJECT', 'REJECT PERPANJANGAN'].includes(statusPengajuan.toUpperCase())) {
        return { boleh: false, alasan: 'Pengajuan ini sudah ditolak' };
    }
    const berjalan = tahapBerjalan(rantai);
    if (!berjalan) {
        // Menutup keputusan ganda: seluruh tahap sudah diputuskan.
        return { boleh: false, alasan: 'Pengajuan ini sudah melewati seluruh tahap persetujuan' };
    }
    const perluPeran = exports.PERAN_TAHAP[berjalan.tahap];
    if (!perluPeran.some((p) => peranPengguna.includes(p))) {
        return {
            boleh: false,
            alasan: `Tahap ${berjalan.tahap} hanya dapat diputuskan pemegang peran ${perluPeran.join(', ')}`,
        };
    }
    return { boleh: true, baris: berjalan };
}
/**
 * Status pengajuan setelah sebuah keputusan.
 *
 * Nilainya sama persis dengan sistem lama (PRD 8.2) supaya perbandingan
 * perilaku tetap mungkin, dan supaya laporan lama tidak berubah artinya.
 */
function statusSetelahKeputusan(rantai, tahapDiputuskan, keputusan) {
    if (keputusan === 'TOLAK')
        return 'REJECT';
    const urut = [...rantai].sort((a, b) => a.urutan - b.urutan);
    const posisi = urut.findIndex((b) => b.tahap === tahapDiputuskan);
    const berikutnya = urut[posisi + 1];
    if (!berikutnya)
        return 'APPROVED';
    if (berikutnya.tahap === 'MANAJER')
        return 'WAPPR MGR';
    if (berikutnya.tahap === 'GM')
        return 'WAPPR GM';
    return 'APPROVED';
}
/**
 * Penolakan wajib disertai alasan.
 *
 * 114 dari 122 penolakan di data produksi hanya berisi pesan generik. Parameter
 * alasannya sudah tersedia sejak dulu, tetapi tidak pernah diisi karena tidak
 * ada yang mewajibkannya.
 */
function periksaAlasan(keputusan, alasan) {
    if (keputusan !== 'TOLAK')
        return null;
    if (!alasan?.trim())
        return 'Alasan penolakan wajib diisi';
    if (alasan.trim().length < 5)
        return 'Alasan penolakan terlalu singkat';
    return null;
}
/** Alasan siap pakai, disusun dari alasan yang benar-benar muncul di data lama. */
exports.ALASAN_SIAP_PAKAI = [
    'Nomor WO belum diisi',
    'Alat sedang dipakai pekerjaan lain',
    'Tanggal peminjaman bentrok',
    'Kelengkapan alat belum memadai',
    'Belum ada task pengujian',
];
//# sourceMappingURL=keputusan.js.map