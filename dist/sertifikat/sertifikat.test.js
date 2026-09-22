"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const sertifikat_1 = require("./sertifikat");
const HARI_INI = '2026-09-21';
const isi = (ubah = {}) => ({
    nomor: '05552/GQI-Sert/06/26',
    tanggalKalibrasi: '2026-06-29',
    tanggalSaran: '2027-06-29',
    hasil: 'Baik',
    pelaksana: 'PT Global Quality Indonesia',
    ...ubah,
});
(0, vitest_1.describe)('statusSertifikat', () => {
    (0, vitest_1.it)('menandai kedaluwarsa ketika tanggal kalibrasi ulang sudah lewat', () => {
        (0, vitest_1.expect)((0, sertifikat_1.statusSertifikat)('2026-03-31', HARI_INI)).toEqual({ status: 'LEWAT', sisaHari: -174 });
    });
    (0, vitest_1.it)('menandai segera habis dalam 90 hari', () => {
        (0, vitest_1.expect)((0, sertifikat_1.statusSertifikat)('2026-10-01', HARI_INI).status).toBe('SEGERA');
        (0, vitest_1.expect)((0, sertifikat_1.statusSertifikat)('2026-12-20', HARI_INI).status).toBe('SEGERA');
    });
    (0, vitest_1.it)('menandai berlaku bila masih lebih dari 90 hari', () => {
        (0, vitest_1.expect)((0, sertifikat_1.statusSertifikat)('2027-06-29', HARI_INI).status).toBe('BERLAKU');
    });
    (0, vitest_1.it)('membedakan sertifikat tanpa tanggal kalibrasi ulang', () => {
        (0, vitest_1.expect)((0, sertifikat_1.statusSertifikat)(null, HARI_INI)).toEqual({ status: 'TANPA_TANGGAL', sisaHari: null });
    });
    (0, vitest_1.it)('menghitung hari ini sebagai batas terakhir, bukan kedaluwarsa', () => {
        (0, vitest_1.expect)((0, sertifikat_1.statusSertifikat)(HARI_INI, HARI_INI)).toEqual({ status: 'SEGERA', sisaHari: 0 });
    });
});
(0, vitest_1.describe)('bakukanHasil', () => {
    (0, vitest_1.it)('menyatukan belasan cara penulisan menjadi dua nilai', () => {
        for (const t of ['Baik', 'BAIK', 'sesuai', 'sesua', 'Siap Digunakan, Baik', 'diterima'])
            (0, vitest_1.expect)((0, sertifikat_1.bakukanHasil)(t)).toBe('BAIK');
        (0, vitest_1.expect)((0, sertifikat_1.bakukanHasil)('Good condition and ready to use')).toBe('BAIK');
    });
    (0, vitest_1.it)('mendahulukan penolakan agar "tidak sesuai" tidak terbaca baik', () => {
        (0, vitest_1.expect)((0, sertifikat_1.bakukanHasil)('Tidak sesuai')).toBe('TIDAK SESUAI');
        (0, vitest_1.expect)((0, sertifikat_1.bakukanHasil)('rusak, gagal uji')).toBe('TIDAK SESUAI');
    });
    (0, vitest_1.it)('membiarkan hasil kosong tetap kosong', () => {
        (0, vitest_1.expect)((0, sertifikat_1.bakukanHasil)(null)).toBeNull();
        (0, vitest_1.expect)((0, sertifikat_1.bakukanHasil)('   ')).toBeNull();
    });
});
(0, vitest_1.describe)('kunciPelaksana', () => {
    (0, vitest_1.it)('menyatukan penulisan yang sama', () => {
        (0, vitest_1.expect)((0, sertifikat_1.kunciPelaksana)('PT Delta Instrumentasi')).toBe((0, sertifikat_1.kunciPelaksana)('PT. DELTA INSTRUMENTASI'));
        (0, vitest_1.expect)((0, sertifikat_1.kunciPelaksana)('PT.PLN (PERSERO) PUSAT SERTIFIKASI')).toBe('PLN PUSAT SERTIFIKASI');
    });
});
(0, vitest_1.describe)('periksaSertifikat', () => {
    (0, vitest_1.it)('menerima isian yang lengkap', () => {
        (0, vitest_1.expect)((0, sertifikat_1.periksaSertifikat)(isi(), HARI_INI)).toEqual([]);
    });
    (0, vitest_1.it)('menolak nomor kosong', () => {
        (0, vitest_1.expect)((0, sertifikat_1.periksaSertifikat)(isi({ nomor: '  ' }), HARI_INI)).toEqual([
            { field: 'nomor', message: 'Nomor sertifikat wajib diisi' },
        ]);
    });
    (0, vitest_1.it)('menolak tanggal kalibrasi di masa depan', () => {
        const salah = (0, sertifikat_1.periksaSertifikat)(isi({ tanggalKalibrasi: '2026-12-01' }), HARI_INI);
        (0, vitest_1.expect)(salah.map((x) => x.field)).toEqual(['tanggalKalibrasi']);
    });
    (0, vitest_1.it)('menolak tanggal kalibrasi ulang yang mendahului tanggal kalibrasi', () => {
        const salah = (0, sertifikat_1.periksaSertifikat)(isi({ tanggalKalibrasi: '2026-06-29', tanggalSaran: '2026-01-01' }), HARI_INI);
        (0, vitest_1.expect)(salah.map((x) => x.field)).toEqual(['tanggalSaran']);
    });
    (0, vitest_1.it)('membolehkan tanggal kalibrasi ulang kosong', () => {
        (0, vitest_1.expect)((0, sertifikat_1.periksaSertifikat)(isi({ tanggalSaran: null }), HARI_INI)).toEqual([]);
    });
});
(0, vitest_1.describe)('saranSetahun', () => {
    (0, vitest_1.it)('menambah satu tahun dari tanggal kalibrasi', () => {
        (0, vitest_1.expect)((0, sertifikat_1.saranSetahun)('2026-06-29')).toBe('2027-06-29');
    });
    (0, vitest_1.it)('mengabaikan tanggal yang tidak sah', () => {
        (0, vitest_1.expect)((0, sertifikat_1.saranSetahun)('kemarin')).toBeNull();
    });
});
//# sourceMappingURL=sertifikat.test.js.map