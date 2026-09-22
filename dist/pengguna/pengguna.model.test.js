"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const pengguna_model_1 = require("./pengguna.model");
function baris(ubah = {}) {
    return {
        ID: 1,
        NAMA: 'Budi Santoso',
        EMAIL: 'budi@contoh.local',
        USERNAME: 'BUDI',
        NIPEG: '123',
        UNIT_ID: 7,
        NAMA_UNIT: 'MSU',
        JABATAN: null,
        SUMBER_UNIT: 'MIGRASI',
        DUPLIKAT_DARI: null,
        NONAKTIF_PADA: null,
        PERAN: 'PENGELOLA,PEMINJAM',
        ...ubah,
    };
}
(0, vitest_1.describe)('kePengguna', () => {
    (0, vitest_1.it)('memecah daftar peran menjadi larik', () => {
        (0, vitest_1.expect)((0, pengguna_model_1.kePengguna)(baris()).peran).toEqual(['PENGELOLA', 'PEMINJAM']);
    });
    (0, vitest_1.it)('menghasilkan larik kosong bila pengguna tidak punya peran', () => {
        (0, vitest_1.expect)((0, pengguna_model_1.kePengguna)(baris({ PERAN: null })).peran).toEqual([]);
    });
    (0, vitest_1.it)('membuang nilai peran yang tidak dikenal', () => {
        // Menjaga dari nilai lama yang belum sempat dipetakan saat migrasi.
        (0, vitest_1.expect)((0, pengguna_model_1.kePengguna)(baris({ PERAN: 'PENGELOLA,SPTOOL' })).peran).toEqual(['PENGELOLA']);
    });
    (0, vitest_1.it)('menganggap baris duplikat sebagai tidak aktif', () => {
        // 113 baris hasil pencatatan berulang di sistem lama (PRD 7.3).
        (0, vitest_1.expect)((0, pengguna_model_1.kePengguna)(baris({ DUPLIKAT_DARI: 5 })).aktif).toBe(false);
    });
    (0, vitest_1.it)('menganggap baris yang dinonaktifkan sebagai tidak aktif', () => {
        (0, vitest_1.expect)((0, pengguna_model_1.kePengguna)(baris({ NONAKTIF_PADA: new Date() })).aktif).toBe(false);
    });
    (0, vitest_1.it)('membiarkan unit kosong apa adanya, tidak menebak', () => {
        const p = (0, pengguna_model_1.kePengguna)(baris({ UNIT_ID: null, NAMA_UNIT: null, SUMBER_UNIT: null }));
        (0, vitest_1.expect)(p.unitId).toBeNull();
        (0, vitest_1.expect)(p.sumberUnit).toBeNull();
    });
});
(0, vitest_1.describe)('punyaSalahSatuPeran', () => {
    const pengguna = (0, pengguna_model_1.kePengguna)(baris());
    (0, vitest_1.it)('benar bila salah satu peran cocok', () => {
        (0, vitest_1.expect)((0, pengguna_model_1.punyaSalahSatuPeran)(pengguna, ['MANAJER', 'PENGELOLA'])).toBe(true);
    });
    (0, vitest_1.it)('salah bila tidak ada yang cocok', () => {
        (0, vitest_1.expect)((0, pengguna_model_1.punyaSalahSatuPeran)(pengguna, ['ADMIN_SUPER'])).toBe(false);
    });
    (0, vitest_1.it)('benar bila tidak ada peran yang diminta', () => {
        (0, vitest_1.expect)((0, pengguna_model_1.punyaSalahSatuPeran)(pengguna, [])).toBe(true);
    });
});
(0, vitest_1.describe)('bolehMasuk', () => {
    (0, vitest_1.it)('mengizinkan pengguna aktif tanpa peran sekalipun', () => {
        // Pengguna tanpa peran tetap berhak melihat profilnya sendiri.
        (0, vitest_1.expect)((0, pengguna_model_1.bolehMasuk)((0, pengguna_model_1.kePengguna)(baris({ PERAN: null })))).toBe(true);
    });
    (0, vitest_1.it)('menolak baris duplikat', () => {
        (0, vitest_1.expect)((0, pengguna_model_1.bolehMasuk)((0, pengguna_model_1.kePengguna)(baris({ DUPLIKAT_DARI: 5 })))).toBe(false);
    });
});
//# sourceMappingURL=pengguna.model.test.js.map