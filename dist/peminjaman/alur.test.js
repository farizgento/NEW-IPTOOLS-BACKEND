"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const alur_1 = require("./alur");
(0, vitest_1.describe)('tentukanAlur', () => {
    (0, vitest_1.it)('dalam unit bila seluruh alat milik unit peminjam', () => {
        (0, vitest_1.expect)((0, alur_1.tentukanAlur)({ unitPeminjamId: 7, unitAlatIds: [7, 7] })).toBe('DALAM_UNIT');
    });
    (0, vitest_1.it)('ambil di gudang bila dalam unit dan diminta demikian', () => {
        (0, vitest_1.expect)((0, alur_1.tentukanAlur)({ unitPeminjamId: 7, unitAlatIds: [7], ambilDiGudang: true })).toBe('DALAM_UNIT_GUDANG');
    });
    (0, vitest_1.it)('antar unit bila satu saja alat berasal dari unit lain', () => {
        // Tingkat approval mengikuti bagian yang paling menuntut.
        (0, vitest_1.expect)((0, alur_1.tentukanAlur)({ unitPeminjamId: 7, unitAlatIds: [7, 7, 9] })).toBe('ANTAR_UNIT');
    });
    (0, vitest_1.it)('eksternal mengalahkan pemeriksaan unit', () => {
        (0, vitest_1.expect)((0, alur_1.tentukanAlur)({ unitPeminjamId: 7, unitAlatIds: [7], eksternal: true })).toBe('EKSTERNAL');
    });
    (0, vitest_1.it)('ambil di gudang diabaikan bila alatnya antar unit', () => {
        (0, vitest_1.expect)((0, alur_1.tentukanAlur)({ unitPeminjamId: 7, unitAlatIds: [9], ambilDiGudang: true })).toBe('ANTAR_UNIT');
    });
    (0, vitest_1.describe)('ketika unit belum diketahui', () => {
        // 294 pengguna belum punya unit selama akses kepegawaian belum tersedia
        // (PRD 6.2.1). Menebak "dalam unit" berarti melewatkan approval Manajer,
        // jadi sisi amannya adalah menuntut approval lebih banyak.
        (0, vitest_1.it)('memilih antar unit bila unit peminjam kosong', () => {
            (0, vitest_1.expect)((0, alur_1.tentukanAlur)({ unitPeminjamId: null, unitAlatIds: [7] })).toBe('ANTAR_UNIT');
        });
        (0, vitest_1.it)('memilih antar unit bila ada alat tanpa unit', () => {
            (0, vitest_1.expect)((0, alur_1.tentukanAlur)({ unitPeminjamId: 7, unitAlatIds: [7, null] })).toBe('ANTAR_UNIT');
        });
        (0, vitest_1.it)('tetap eksternal meski unit kosong', () => {
            (0, vitest_1.expect)((0, alur_1.tentukanAlur)({ unitPeminjamId: null, unitAlatIds: [], eksternal: true })).toBe('EKSTERNAL');
        });
    });
});
(0, vitest_1.describe)('rantaiUntuk', () => {
    (0, vitest_1.it)('dalam unit cukup pengelola — sesuai SK Lampiran 2 alur 1', () => {
        (0, vitest_1.expect)((0, alur_1.rantaiUntuk)('DALAM_UNIT')).toEqual(['PENGELOLA']);
        (0, vitest_1.expect)((0, alur_1.rantaiUntuk)('DALAM_UNIT_GUDANG')).toEqual(['PENGELOLA']);
    });
    (0, vitest_1.it)('antar unit menambah manajer — SK Lampiran 2 alur 2', () => {
        (0, vitest_1.expect)((0, alur_1.rantaiUntuk)('ANTAR_UNIT')).toEqual(['PENGELOLA', 'MANAJER']);
    });
    (0, vitest_1.it)('eksternal menambah GM — SK Lampiran 3', () => {
        (0, vitest_1.expect)((0, alur_1.rantaiUntuk)('EKSTERNAL')).toEqual(['PENGELOLA', 'MANAJER', 'GM']);
    });
});
(0, vitest_1.describe)('masihBerjalan', () => {
    (0, vitest_1.it)('pengajuan selesai tidak lagi memakai alatnya', () => {
        (0, vitest_1.expect)((0, alur_1.masihBerjalan)('FINISH')).toBe(false);
        (0, vitest_1.expect)((0, alur_1.masihBerjalan)('PARTIAL FINISH')).toBe(false);
        (0, vitest_1.expect)((0, alur_1.masihBerjalan)('REJECT')).toBe(false);
    });
    (0, vitest_1.it)('pengajuan yang belum tuntas masih memakai alatnya', () => {
        (0, vitest_1.expect)((0, alur_1.masihBerjalan)('BOOKED')).toBe(true);
        (0, vitest_1.expect)((0, alur_1.masihBerjalan)('SENT')).toBe(true);
        (0, vitest_1.expect)((0, alur_1.masihBerjalan)('PARTIAL RECEIVED')).toBe(true);
    });
    (0, vitest_1.it)('tidak peduli besar kecil huruf', () => {
        (0, vitest_1.expect)((0, alur_1.masihBerjalan)('finish')).toBe(false);
    });
});
//# sourceMappingURL=alur.test.js.map