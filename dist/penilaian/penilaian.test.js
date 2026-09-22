"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const penilaian_1 = require("./penilaian");
/** Cerminan isi kategori_kondisi: 5 grup, bobot berjumlah 100. */
const KATALOG = [
    { id: 1, grup: 1, keterangan: 'Seluruh fungsi tidak bisa digunakan', bobot: 50, nilai: 0 },
    { id: 4, grup: 1, keterangan: 'Seluruh fungsi bisa digunakan', bobot: 50, nilai: 100 },
    { id: 6, grup: 2, keterangan: 'Aksesoris tidak lengkap', bobot: 20, nilai: 0 },
    { id: 9, grup: 2, keterangan: 'Aksesoris lengkap', bobot: 20, nilai: 100 },
    { id: 11, grup: 3, keterangan: 'Software rusak', bobot: 10, nilai: 0 },
    { id: 15, grup: 3, keterangan: 'Software bekerja baik', bobot: 10, nilai: 100 },
    { id: 16, grup: 4, keterangan: 'Sertifikasi kedaluwarsa', bobot: 10, nilai: 0 },
    { id: 17, grup: 4, keterangan: 'Dalam masa aman sertifikasi', bobot: 10, nilai: 100 },
    { id: 18, grup: 5, keterangan: 'Parts cadangan tidak tersedia', bobot: 10, nilai: 0 },
    { id: 21, grup: 5, keterangan: 'Parts cadangan tersedia', bobot: 10, nilai: 100 },
];
const peta = new Map(KATALOG.map((k) => [k.id, k]));
const semuaBaik = [4, 9, 15, 17, 21];
(0, vitest_1.describe)('pilihanKondisiBaik', () => {
    (0, vitest_1.it)('memilih satu pilihan bernilai 100 pada tiap grup', () => {
        (0, vitest_1.expect)((0, penilaian_1.pilihanKondisiBaik)(KATALOG).map((p) => p.id)).toEqual(semuaBaik);
    });
    (0, vitest_1.it)('lengkap untuk kelima grup', () => {
        (0, vitest_1.expect)((0, penilaian_1.kondisiBaikLengkap)(KATALOG)).toBe(true);
    });
    (0, vitest_1.it)('tidak lengkap bila ada grup tanpa pilihan bernilai 100', () => {
        const kurang = KATALOG.filter((k) => k.id !== 21);
        (0, vitest_1.expect)((0, penilaian_1.kondisiBaikLengkap)(kurang)).toBe(false);
    });
});
(0, vitest_1.describe)('validasiPenilaian', () => {
    (0, vitest_1.it)('menerima "semua kondisi baik" tanpa satu pun keterangan', () => {
        // Inilah inti F6: kasus mayoritas tidak menuntut isian apa pun.
        const hasil = (0, penilaian_1.validasiPenilaian)({ peminjamanAlatId: 1, pilihanIds: semuaBaik }, peta);
        (0, vitest_1.expect)(hasil).toEqual([]);
    });
    (0, vitest_1.it)('menuntut keterangan hanya untuk pilihan yang bukan kondisi penuh', () => {
        const hasil = (0, penilaian_1.validasiPenilaian)({ peminjamanAlatId: 1, pilihanIds: [1, 9, 15, 17, 21] }, peta);
        (0, vitest_1.expect)(hasil).toHaveLength(1);
        (0, vitest_1.expect)(hasil[0]?.field).toBe('keterangan.1');
    });
    (0, vitest_1.it)('menerima pilihan bermasalah bila keterangannya diisi', () => {
        const hasil = (0, penilaian_1.validasiPenilaian)({
            peminjamanAlatId: 1,
            pilihanIds: [1, 9, 15, 17, 21],
            keterangan: { 1: 'Motor tidak menyala sejak Agustus' },
        }, peta);
        (0, vitest_1.expect)(hasil).toEqual([]);
    });
    (0, vitest_1.it)('menolak keterangan yang hanya spasi', () => {
        const hasil = (0, penilaian_1.validasiPenilaian)({ peminjamanAlatId: 1, pilihanIds: [1, 9, 15, 17, 21], keterangan: { 1: '   ' } }, peta);
        (0, vitest_1.expect)(hasil).toHaveLength(1);
    });
    (0, vitest_1.it)('menolak bila belum kelima kategori dinilai', () => {
        const hasil = (0, penilaian_1.validasiPenilaian)({ peminjamanAlatId: 1, pilihanIds: [4, 9] }, peta);
        (0, vitest_1.expect)(hasil.some((p) => p.message.includes('Kelima kategori'))).toBe(true);
    });
    (0, vitest_1.it)('menolak dua pilihan dari grup yang sama', () => {
        const hasil = (0, penilaian_1.validasiPenilaian)({ peminjamanAlatId: 1, pilihanIds: [1, 4, 9, 15, 17] }, peta);
        (0, vitest_1.expect)(hasil.some((p) => p.message.includes('lebih dari sekali'))).toBe(true);
    });
    (0, vitest_1.it)('menolak pilihan yang tidak dikenali', () => {
        const hasil = (0, penilaian_1.validasiPenilaian)({ peminjamanAlatId: 1, pilihanIds: [999, 9, 15, 17, 21] }, peta);
        (0, vitest_1.expect)(hasil.some((p) => p.message.includes('tidak dikenali'))).toBe(true);
    });
    (0, vitest_1.it)('menolak daftar pilihan kosong', () => {
        (0, vitest_1.expect)((0, penilaian_1.validasiPenilaian)({ peminjamanAlatId: 1, pilihanIds: [] }, peta)).toHaveLength(1);
    });
});
(0, vitest_1.describe)('hitungNilai', () => {
    (0, vitest_1.it)('kondisi baik seluruhnya bernilai 100', () => {
        const pilihan = semuaBaik.map((id) => peta.get(id));
        (0, vitest_1.expect)((0, penilaian_1.hitungNilai)(pilihan)).toBe(100);
    });
    (0, vitest_1.it)('fungsi alat mati memangkas 50 poin', () => {
        const pilihan = [1, 9, 15, 17, 21].map((id) => peta.get(id));
        (0, vitest_1.expect)((0, penilaian_1.hitungNilai)(pilihan)).toBe(50);
    });
    (0, vitest_1.it)('seluruh kategori bermasalah bernilai 0', () => {
        const pilihan = [1, 6, 11, 16, 18].map((id) => peta.get(id));
        (0, vitest_1.expect)((0, penilaian_1.hitungNilai)(pilihan)).toBe(0);
    });
});
(0, vitest_1.describe)('kategoriBermasalah', () => {
    (0, vitest_1.it)('kosong bila seluruhnya kondisi penuh', () => {
        (0, vitest_1.expect)((0, penilaian_1.kategoriBermasalah)(semuaBaik.map((id) => peta.get(id)))).toEqual([]);
    });
    (0, vitest_1.it)('menyebut kategori yang menyimpang saja', () => {
        const pilihan = [1, 9, 11, 17, 21].map((id) => peta.get(id));
        (0, vitest_1.expect)((0, penilaian_1.kategoriBermasalah)(pilihan).map((p) => p.id)).toEqual([1, 11]);
    });
});
//# sourceMappingURL=penilaian.test.js.map