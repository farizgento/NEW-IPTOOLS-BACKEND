"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const proyek_1 = require("./proyek");
const isi = (ubah = {}) => ({
    nama: 'Overhaul PLTU Suralaya Unit 5',
    tanggalMulai: '2026-10-01',
    tanggalSelesai: '2026-11-30',
    site: 'PLTU Suralaya',
    tipeOhId: null,
    ...ubah,
});
(0, vitest_1.describe)('periksaProyek', () => {
    (0, vitest_1.it)('menerima isian lengkap', () => {
        (0, vitest_1.expect)((0, proyek_1.periksaProyek)(isi())).toEqual([]);
    });
    (0, vitest_1.it)('menolak nama kosong', () => {
        (0, vitest_1.expect)((0, proyek_1.periksaProyek)(isi({ nama: '   ' })).map((x) => x.field)).toEqual(['nama']);
    });
    (0, vitest_1.it)('menolak tanggal selesai yang mendahului tanggal mulai', () => {
        const salah = (0, proyek_1.periksaProyek)(isi({ tanggalMulai: '2026-11-01', tanggalSelesai: '2026-10-01' }));
        (0, vitest_1.expect)(salah.map((x) => x.field)).toEqual(['tanggalSelesai']);
    });
    (0, vitest_1.it)('membolehkan proyek tanpa periode', () => {
        (0, vitest_1.expect)((0, proyek_1.periksaProyek)(isi({ tanggalMulai: null, tanggalSelesai: null }))).toEqual([]);
    });
});
(0, vitest_1.describe)('normalNama', () => {
    (0, vitest_1.it)('menyamakan beda spasi dan huruf besar-kecil', () => {
        (0, vitest_1.expect)((0, proyek_1.normalNama)('  Overhaul   PLTU  ')).toBe((0, proyek_1.normalNama)('overhaul pltu'));
    });
});
(0, vitest_1.describe)('miripProyek', () => {
    (0, vitest_1.it)('menyatakan sama untuk penulisan yang hanya beda spasi', () => {
        (0, vitest_1.expect)((0, proyek_1.miripProyek)('OH SI PLTU Lontar Unit 1', 'OH  SI PLTU LONTAR UNIT 1')).toBe(1);
    });
    (0, vitest_1.it)('tidak menyarankan pekerjaan dengan nomor unit berbeda', () => {
        (0, vitest_1.expect)((0, proyek_1.miripProyek)('Overhaul PLTU Suralaya Unit 5', 'Overhaul PLTU Suralaya Unit 7')).toBe(0);
    });
    (0, vitest_1.it)('memberi nilai di bawah ambang untuk pekerjaan yang hanya mirip sebagian', () => {
        const nilai = (0, proyek_1.miripProyek)('Assessment Boiler PLTU Jeranjang', 'Assessment Turbin PLTU Adipala');
        (0, vitest_1.expect)(nilai).toBeLessThan(proyek_1.AMBANG_MIRIP);
    });
    (0, vitest_1.it)('memberi nilai di atas ambang untuk nama yang sama dengan satu kata tambahan', () => {
        const nilai = (0, proyek_1.miripProyek)('Major Inspection PLTGU Priok Blok 3', 'Major Inspection PLTGU Priok Blok 3 Lanjutan');
        (0, vitest_1.expect)(nilai).toBeGreaterThanOrEqual(proyek_1.AMBANG_MIRIP);
    });
});
//# sourceMappingURL=proyek.test.js.map