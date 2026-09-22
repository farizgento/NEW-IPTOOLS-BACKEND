"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const jadwal_1 = require("./jadwal");
const HARI_INI = '2026-09-21';
const jadwal = (ubah = {}) => ({
    peminjamanAlatId: 1,
    peminjamanId: 10,
    alatId: 100,
    mulai: '2026-09-15',
    selesai: '2026-09-30',
    statusAlat: 'DITERIMA',
    tanggalKembali: null,
    ...ubah,
});
(0, vitest_1.describe)('bertumpuk', () => {
    (0, vitest_1.it)('menghitung hari batas sebagai tumpang', () => {
        (0, vitest_1.expect)((0, jadwal_1.bertumpuk)({ mulai: '2026-09-01', selesai: '2026-09-10' }, { mulai: '2026-09-10', selesai: '2026-09-20' })).toBe(true);
    });
    (0, vitest_1.it)('memisahkan periode yang berurutan tanpa tumpang', () => {
        (0, vitest_1.expect)((0, jadwal_1.bertumpuk)({ mulai: '2026-09-01', selesai: '2026-09-09' }, { mulai: '2026-09-10', selesai: '2026-09-20' })).toBe(false);
    });
});
(0, vitest_1.describe)('statusJadwal', () => {
    (0, vitest_1.it)('menandai alat yang sedang dipakai', () => {
        (0, vitest_1.expect)((0, jadwal_1.statusJadwal)(jadwal(), HARI_INI)).toBe('DIPAKAI');
    });
    (0, vitest_1.it)('menandai lewat jadwal ketika alat belum kembali melewati tanggal selesai', () => {
        (0, vitest_1.expect)((0, jadwal_1.statusJadwal)(jadwal({ selesai: '2026-09-10' }), HARI_INI)).toBe('LEWAT');
    });
    (0, vitest_1.it)('menandai selesai begitu alat dikembalikan', () => {
        (0, vitest_1.expect)((0, jadwal_1.statusJadwal)(jadwal({ selesai: '2026-09-10', tanggalKembali: '2026-09-09' }), HARI_INI)).toBe('SELESAI');
    });
    (0, vitest_1.it)('menandai pengajuan yang belum diserahkan sebagai dijadwalkan', () => {
        (0, vitest_1.expect)((0, jadwal_1.statusJadwal)(jadwal({ statusAlat: 'DIAJUKAN', mulai: '2026-10-01', selesai: '2026-10-10' }), HARI_INI)).toBe('DIJADWALKAN');
    });
    (0, vitest_1.it)('tidak menandai lewat untuk pengajuan lama yang tidak pernah diserahkan', () => {
        (0, vitest_1.expect)((0, jadwal_1.statusJadwal)(jadwal({ statusAlat: 'DIAJUKAN', mulai: '2025-01-01', selesai: '2025-01-10' }), HARI_INI)).toBe('SELESAI');
    });
});
(0, vitest_1.describe)('tandaiTabrakan', () => {
    (0, vitest_1.it)('menandai dua jadwal yang bertumpuk pada alat yang sama', () => {
        const hasil = (0, jadwal_1.tandaiTabrakan)([
            jadwal({ peminjamanAlatId: 1, mulai: '2026-09-20', selesai: '2026-09-27' }),
            jadwal({ peminjamanAlatId: 2, mulai: '2026-09-23', selesai: '2026-10-02' }),
        ], HARI_INI);
        (0, vitest_1.expect)(hasil[0].tabrakDengan).toEqual([2]);
        (0, vitest_1.expect)(hasil[1].tabrakDengan).toEqual([1]);
    });
    (0, vitest_1.it)('menaruh jadwal yang bertumpuk pada jalur berbeda', () => {
        const hasil = (0, jadwal_1.tandaiTabrakan)([
            jadwal({ peminjamanAlatId: 1, mulai: '2026-09-20', selesai: '2026-09-27' }),
            jadwal({ peminjamanAlatId: 2, mulai: '2026-09-23', selesai: '2026-10-02' }),
        ], HARI_INI);
        (0, vitest_1.expect)(hasil.map((x) => x.jalur)).toEqual([0, 1]);
    });
    (0, vitest_1.it)('memakai jalur yang sama untuk jadwal yang tidak bertumpuk', () => {
        const hasil = (0, jadwal_1.tandaiTabrakan)([
            jadwal({ peminjamanAlatId: 1, mulai: '2026-09-01', selesai: '2026-09-05' }),
            jadwal({ peminjamanAlatId: 2, mulai: '2026-09-10', selesai: '2026-09-15' }),
        ], HARI_INI);
        (0, vitest_1.expect)(hasil.map((x) => x.jalur)).toEqual([0, 0]);
        (0, vitest_1.expect)(hasil.every((x) => x.tabrakDengan.length === 0)).toBe(true);
    });
});
(0, vitest_1.describe)('ringkasJadwal', () => {
    (0, vitest_1.it)('menghitung batang per status dan jumlah alat yang bertabrakan', () => {
        const alatA = {
            jadwal: (0, jadwal_1.tandaiTabrakan)([
                jadwal({ peminjamanAlatId: 1, mulai: '2026-09-20', selesai: '2026-09-27' }),
                jadwal({ peminjamanAlatId: 2, mulai: '2026-09-23', selesai: '2026-10-02' }),
            ], HARI_INI),
        };
        const alatB = {
            jadwal: (0, jadwal_1.tandaiTabrakan)([jadwal({ peminjamanAlatId: 3, alatId: 200, statusAlat: 'DIAJUKAN', mulai: '2026-10-05', selesai: '2026-10-09' })], HARI_INI),
        };
        (0, vitest_1.expect)((0, jadwal_1.ringkasJadwal)([alatA, alatB])).toEqual({
            dipakai: 2,
            dijadwalkan: 1,
            lewat: 0,
            selesai: 0,
            alatBertabrakan: 1,
        });
    });
});
//# sourceMappingURL=jadwal.test.js.map