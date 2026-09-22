"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const keputusan_1 = require("./keputusan");
const rantaiAntarUnit = [
    { urutan: 1, tahap: 'PENGELOLA', keputusan: 'MENUNGGU' },
    { urutan: 2, tahap: 'MANAJER', keputusan: 'MENUNGGU' },
];
const rantaiDalamUnit = [
    { urutan: 1, tahap: 'PENGELOLA', keputusan: 'MENUNGGU' },
];
const rantaiEksternal = [
    { urutan: 1, tahap: 'PENGELOLA', keputusan: 'SETUJU' },
    { urutan: 2, tahap: 'MANAJER', keputusan: 'MENUNGGU' },
    { urutan: 3, tahap: 'GM', keputusan: 'MENUNGGU' },
];
(0, vitest_1.describe)('tahapBerjalan', () => {
    (0, vitest_1.it)('memilih tahap paling awal yang belum diputuskan', () => {
        (0, vitest_1.expect)((0, keputusan_1.tahapBerjalan)(rantaiAntarUnit)?.tahap).toBe('PENGELOLA');
    });
    (0, vitest_1.it)('berpindah ke tahap berikutnya setelah yang awal diputuskan', () => {
        (0, vitest_1.expect)((0, keputusan_1.tahapBerjalan)(rantaiEksternal)?.tahap).toBe('MANAJER');
    });
    (0, vitest_1.it)('tidak menghasilkan apa pun bila seluruh tahap selesai', () => {
        (0, vitest_1.expect)((0, keputusan_1.tahapBerjalan)([{ urutan: 1, tahap: 'PENGELOLA', keputusan: 'SETUJU' }])).toBeUndefined();
    });
    (0, vitest_1.it)('tidak terpengaruh urutan baris yang tidak terurut', () => {
        const acak = [
            { urutan: 2, tahap: 'MANAJER', keputusan: 'MENUNGGU' },
            { urutan: 1, tahap: 'PENGELOLA', keputusan: 'MENUNGGU' },
        ];
        (0, vitest_1.expect)((0, keputusan_1.tahapBerjalan)(acak)?.tahap).toBe('PENGELOLA');
    });
});
(0, vitest_1.describe)('bolehMemutuskan', () => {
    (0, vitest_1.it)('mengizinkan pengelola pada tahap pertama', () => {
        (0, vitest_1.expect)((0, keputusan_1.bolehMemutuskan)(rantaiAntarUnit, ['PENGELOLA'], 'BOOKED').boleh).toBe(true);
    });
    (0, vitest_1.it)('menolak manajer yang mendahului pengelola', () => {
        // SK menempatkan review SP/SPS lebih dulu; rantai berjalan berurutan.
        const hasil = (0, keputusan_1.bolehMemutuskan)(rantaiAntarUnit, ['MANAJER'], 'BOOKED');
        (0, vitest_1.expect)(hasil.boleh).toBe(false);
        if (!hasil.boleh)
            (0, vitest_1.expect)(hasil.alasan).toMatch(/PENGELOLA/);
    });
    (0, vitest_1.it)('mengizinkan manajer setelah giliran pengelola lewat', () => {
        (0, vitest_1.expect)((0, keputusan_1.bolehMemutuskan)(rantaiEksternal, ['MANAJER'], 'WAPPR MGR').boleh).toBe(true);
    });
    (0, vitest_1.it)('menolak peminjam biasa', () => {
        (0, vitest_1.expect)((0, keputusan_1.bolehMemutuskan)(rantaiAntarUnit, ['PEMINJAM'], 'BOOKED').boleh).toBe(false);
    });
    (0, vitest_1.it)('menolak admin super sekalipun', () => {
        // Mengelola master data bukan berarti berhak menyetujui peminjaman.
        (0, vitest_1.expect)((0, keputusan_1.bolehMemutuskan)(rantaiAntarUnit, ['ADMIN_SUPER'], 'BOOKED').boleh).toBe(false);
    });
    (0, vitest_1.it)('menolak keputusan ganda', () => {
        const selesai = [{ urutan: 1, tahap: 'PENGELOLA', keputusan: 'SETUJU' }];
        const hasil = (0, keputusan_1.bolehMemutuskan)(selesai, ['PENGELOLA'], 'APPROVED');
        (0, vitest_1.expect)(hasil.boleh).toBe(false);
        if (!hasil.boleh)
            (0, vitest_1.expect)(hasil.alasan).toMatch(/seluruh tahap/);
    });
    (0, vitest_1.it)('menolak keputusan atas pengajuan yang sudah ditolak', () => {
        const hasil = (0, keputusan_1.bolehMemutuskan)(rantaiAntarUnit, ['PENGELOLA'], 'REJECT');
        (0, vitest_1.expect)(hasil.boleh).toBe(false);
        if (!hasil.boleh)
            (0, vitest_1.expect)(hasil.alasan).toMatch(/ditolak/);
    });
});
(0, vitest_1.describe)('statusSetelahKeputusan', () => {
    (0, vitest_1.it)('dalam unit: pengelola setuju langsung APPROVED', () => {
        (0, vitest_1.expect)((0, keputusan_1.statusSetelahKeputusan)(rantaiDalamUnit, 'PENGELOLA', 'SETUJU')).toBe('APPROVED');
    });
    (0, vitest_1.it)('antar unit: pengelola setuju menjadi WAPPR MGR', () => {
        (0, vitest_1.expect)((0, keputusan_1.statusSetelahKeputusan)(rantaiAntarUnit, 'PENGELOLA', 'SETUJU')).toBe('WAPPR MGR');
    });
    (0, vitest_1.it)('antar unit: manajer setuju menjadi APPROVED', () => {
        (0, vitest_1.expect)((0, keputusan_1.statusSetelahKeputusan)(rantaiAntarUnit, 'MANAJER', 'SETUJU')).toBe('APPROVED');
    });
    (0, vitest_1.it)('eksternal: manajer setuju menjadi WAPPR GM', () => {
        (0, vitest_1.expect)((0, keputusan_1.statusSetelahKeputusan)(rantaiEksternal, 'MANAJER', 'SETUJU')).toBe('WAPPR GM');
    });
    (0, vitest_1.it)('eksternal: GM setuju menjadi APPROVED', () => {
        (0, vitest_1.expect)((0, keputusan_1.statusSetelahKeputusan)(rantaiEksternal, 'GM', 'SETUJU')).toBe('APPROVED');
    });
    (0, vitest_1.it)('penolakan pada tahap mana pun menjadi REJECT', () => {
        (0, vitest_1.expect)((0, keputusan_1.statusSetelahKeputusan)(rantaiAntarUnit, 'PENGELOLA', 'TOLAK')).toBe('REJECT');
        (0, vitest_1.expect)((0, keputusan_1.statusSetelahKeputusan)(rantaiEksternal, 'GM', 'TOLAK')).toBe('REJECT');
    });
});
(0, vitest_1.describe)('periksaAlasan', () => {
    (0, vitest_1.it)('tidak menuntut alasan saat menyetujui', () => {
        (0, vitest_1.expect)((0, keputusan_1.periksaAlasan)('SETUJU')).toBeNull();
    });
    (0, vitest_1.it)('menuntut alasan saat menolak', () => {
        // 93% penolakan di data lama tanpa alasan spesifik.
        (0, vitest_1.expect)((0, keputusan_1.periksaAlasan)('TOLAK')).toMatch(/wajib/);
        (0, vitest_1.expect)((0, keputusan_1.periksaAlasan)('TOLAK', '   ')).toMatch(/wajib/);
    });
    (0, vitest_1.it)('menolak alasan yang terlalu singkat', () => {
        (0, vitest_1.expect)((0, keputusan_1.periksaAlasan)('TOLAK', 'ga')).toMatch(/singkat/);
    });
    (0, vitest_1.it)('menerima alasan yang bermakna', () => {
        (0, vitest_1.expect)((0, keputusan_1.periksaAlasan)('TOLAK', 'Nomor WO belum diisi')).toBeNull();
    });
});
//# sourceMappingURL=keputusan.test.js.map