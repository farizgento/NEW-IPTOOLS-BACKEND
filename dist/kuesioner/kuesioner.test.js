"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const kuesioner_1 = require("./kuesioner");
const PERTANYAAN = [
    { id: 1, kategori: 'Availability', pertanyaan: 'Alat tersedia saat dibutuhkan' },
    { id: 2, kategori: 'Reliability', pertanyaan: 'Alat berfungsi baik' },
    { id: 3, kategori: 'Kritik', pertanyaan: 'Kritik' },
    { id: 4, kategori: 'Saran', pertanyaan: 'Saran' },
];
const lengkap = [
    { pertanyaanId: 1, kepentingan: 5, kinerja: 4 },
    { pertanyaanId: 2, kepentingan: 4, kinerja: 4 },
    { pertanyaanId: 3, teks: 'Proses peminjaman terlalu lama' },
    { pertanyaanId: 4, teks: 'Perkuat jaringan area' },
];
(0, vitest_1.describe)('bentukPertanyaan', () => {
    (0, vitest_1.it)('kritik dan saran berupa teks', () => {
        (0, vitest_1.expect)((0, kuesioner_1.bentukPertanyaan)(PERTANYAAN[2])).toBe('TEKS');
        (0, vitest_1.expect)((0, kuesioner_1.bentukPertanyaan)({ id: 9, kategori: ' saran ', pertanyaan: 'x' })).toBe('TEKS');
    });
    (0, vitest_1.it)('kategori lain berupa skala', () => {
        (0, vitest_1.expect)((0, kuesioner_1.bentukPertanyaan)(PERTANYAAN[0])).toBe('SKALA');
    });
});
(0, vitest_1.describe)('validasiJawaban', () => {
    (0, vitest_1.it)('menerima jawaban lengkap yang sah', () => {
        (0, vitest_1.expect)((0, kuesioner_1.validasiJawaban)(PERTANYAAN, lengkap)).toEqual([]);
    });
    (0, vitest_1.it)('menolak skala di luar 1–5', () => {
        const hasil = (0, kuesioner_1.validasiJawaban)(PERTANYAAN, [{ pertanyaanId: 1, kepentingan: 6, kinerja: 0 }]);
        (0, vitest_1.expect)(hasil.map((h) => h.field)).toEqual(['jawaban.1.kepentingan', 'jawaban.1.kinerja']);
    });
    (0, vitest_1.it)('menolak skala pecahan', () => {
        (0, vitest_1.expect)((0, kuesioner_1.validasiJawaban)(PERTANYAAN, [{ pertanyaanId: 1, kepentingan: 3.5, kinerja: 3 }])).toHaveLength(1);
    });
    (0, vitest_1.it)('menolak kritik yang kosong', () => {
        (0, vitest_1.expect)((0, kuesioner_1.validasiJawaban)(PERTANYAAN, [{ pertanyaanId: 3, teks: '  ' }])).toHaveLength(1);
    });
    (0, vitest_1.it)('menolak satu pertanyaan dijawab dua kali', () => {
        // Celah procedure lama: jawaban ganda dihitung sebagai dua jawaban.
        const hasil = (0, kuesioner_1.validasiJawaban)(PERTANYAAN, [
            { pertanyaanId: 1, kepentingan: 5, kinerja: 5 },
            { pertanyaanId: 1, kepentingan: 4, kinerja: 4 },
        ]);
        (0, vitest_1.expect)(hasil[0]?.message).toMatch(/lebih dari sekali/);
    });
    (0, vitest_1.it)('menolak pertanyaan yang tidak dikenali', () => {
        (0, vitest_1.expect)((0, kuesioner_1.validasiJawaban)(PERTANYAAN, [{ pertanyaanId: 99, kepentingan: 5, kinerja: 5 }])).toHaveLength(1);
    });
});
(0, vitest_1.describe)('sesiLengkap', () => {
    (0, vitest_1.it)('lengkap bila setiap pertanyaan terjawab', () => {
        (0, vitest_1.expect)((0, kuesioner_1.sesiLengkap)([1, 2, 3, 4], [1, 2, 3, 4])).toBe(true);
    });
    (0, vitest_1.it)('tidak lengkap bila ada yang terlewat, meski jumlahnya sama', () => {
        // Empat jawaban, tetapi pertanyaan 1 dijawab dua kali dan pertanyaan 4
        // terlewat. Procedure lama menganggap ini lengkap.
        (0, vitest_1.expect)((0, kuesioner_1.sesiLengkap)([1, 2, 3, 4], [1, 1, 2, 3])).toBe(false);
    });
    (0, vitest_1.it)('tidak lengkap bila bank pertanyaan kosong', () => {
        (0, vitest_1.expect)((0, kuesioner_1.sesiLengkap)([], [])).toBe(false);
    });
});
(0, vitest_1.describe)('rekapIpa', () => {
    const baris = [
        // Pertanyaan 1: sangat penting, kinerja rendah → perlu diperbaiki
        { pertanyaanId: 1, kepentingan: 5, kinerja: 2 },
        { pertanyaanId: 1, kepentingan: 5, kinerja: 3 },
        // Pertanyaan 2: penting dan memuaskan
        { pertanyaanId: 2, kepentingan: 5, kinerja: 5 },
        // Pertanyaan 3: kurang penting, kinerja tinggi
        { pertanyaanId: 3, kepentingan: 2, kinerja: 5 },
    ];
    (0, vitest_1.it)('menghitung rata-rata dan selisih', () => {
        const p1 = (0, kuesioner_1.rekapIpa)(baris).find((r) => r.pertanyaanId === 1);
        (0, vitest_1.expect)(p1.rataKepentingan).toBe(5);
        (0, vitest_1.expect)(p1.rataKinerja).toBe(2.5);
        (0, vitest_1.expect)(p1.selisih).toBe(2.5);
        (0, vitest_1.expect)(p1.jumlahResponden).toBe(2);
    });
    (0, vitest_1.it)('menempatkan yang penting tetapi kurang memuaskan di prioritas perbaikan', () => {
        const hasil = (0, kuesioner_1.rekapIpa)(baris);
        (0, vitest_1.expect)(hasil.find((r) => r.pertanyaanId === 1)?.prioritas).toBe('PERBAIKI');
        (0, vitest_1.expect)(hasil.find((r) => r.pertanyaanId === 2)?.prioritas).toBe('PERTAHANKAN');
        (0, vitest_1.expect)(hasil.find((r) => r.pertanyaanId === 3)?.prioritas).toBe('BERLEBIH');
    });
    (0, vitest_1.it)('mengurutkan dari selisih terbesar', () => {
        (0, vitest_1.expect)((0, kuesioner_1.rekapIpa)(baris)[0]?.pertanyaanId).toBe(1);
    });
    (0, vitest_1.it)('aman untuk data kosong', () => {
        (0, vitest_1.expect)((0, kuesioner_1.rekapIpa)([])).toEqual([]);
    });
});
//# sourceMappingURL=kuesioner.test.js.map