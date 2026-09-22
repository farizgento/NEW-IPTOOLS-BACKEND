"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const konfigurasi_1 = require("./konfigurasi");
const dasar = {
    DB_HOST: 'localhost',
    DB_SERVICE: 'XEPDB1',
    DB_USER: 'IPTOOLS_NEW',
    DB_PASSWORD: 'rahasia',
    JWT_RAHASIA: 'kunci-uji-yang-panjangnya-lebih-dari-32-karakter',
};
(0, vitest_1.describe)('bacaKonfigurasi', () => {
    (0, vitest_1.it)('mengisi nilai bawaan yang wajar', () => {
        const k = (0, konfigurasi_1.bacaKonfigurasi)(dasar);
        (0, vitest_1.expect)(k.PORT).toBe(3001);
        (0, vitest_1.expect)(k.DB_PORT).toBe(1521);
        (0, vitest_1.expect)(k.AUTH_LEWATI_DIREKTORI).toBe(false);
    });
    (0, vitest_1.it)('menolak kunci token yang terlalu pendek', () => {
        (0, vitest_1.expect)(() => (0, konfigurasi_1.bacaKonfigurasi)({ ...dasar, JWT_RAHASIA: 'pendek' })).toThrow(/JWT_RAHASIA/);
    });
    (0, vitest_1.it)('menolak konfigurasi tanpa alamat basis data', () => {
        const { DB_HOST: _abaikan, ...tanpaHost } = dasar;
        (0, vitest_1.expect)(() => (0, konfigurasi_1.bacaKonfigurasi)(tanpaHost)).toThrow(/DB_HOST/);
    });
    (0, vitest_1.it)('menolak jalan pintas autentikasi di produksi', () => {
        // Pengaman terpenting di berkas ini: jalur pintas tidak boleh ikut terbawa
        // ke lingkungan nyata karena kelalaian mengubah .env.
        (0, vitest_1.expect)(() => (0, konfigurasi_1.bacaKonfigurasi)({ ...dasar, NODE_ENV: 'production', AUTH_LEWATI_DIREKTORI: 'true' })).toThrow(/AUTH_LEWATI_DIREKTORI/);
    });
    (0, vitest_1.it)('mengizinkan jalan pintas di luar produksi', () => {
        const k = (0, konfigurasi_1.bacaKonfigurasi)({ ...dasar, NODE_ENV: 'development', AUTH_LEWATI_DIREKTORI: 'true' });
        (0, vitest_1.expect)(k.AUTH_LEWATI_DIREKTORI).toBe(true);
    });
});
//# sourceMappingURL=konfigurasi.test.js.map