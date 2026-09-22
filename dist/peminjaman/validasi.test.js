"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const validasi_1 = require("./validasi");
const sah = {
    pekerjaan: 'Overhaul turbin',
    nomorWo: 'WO-12345',
    tanggalMulai: '2026-09-01',
    tanggalSelesai: '2026-09-10',
    alatIds: [1, 2],
};
function pesan(hasil, field) {
    return hasil.find((p) => p.field === field)?.message;
}
(0, vitest_1.describe)('validasiPengajuan', () => {
    (0, vitest_1.it)('menerima pengajuan yang lengkap', () => {
        (0, vitest_1.expect)((0, validasi_1.validasiPengajuan)(sah)).toEqual([]);
    });
    (0, vitest_1.it)('menolak tanpa nomor WO', () => {
        // Penyebab penolakan paling sering di data produksi.
        (0, vitest_1.expect)(pesan((0, validasi_1.validasiPengajuan)({ ...sah, nomorWo: '' }), 'nomorWo')).toMatch(/Nomor WO/);
        (0, vitest_1.expect)(pesan((0, validasi_1.validasiPengajuan)({ ...sah, nomorWo: '   ' }), 'nomorWo')).toMatch(/Nomor WO/);
    });
    (0, vitest_1.it)('menolak tanpa pekerjaan', () => {
        (0, vitest_1.expect)(pesan((0, validasi_1.validasiPengajuan)({ ...sah, pekerjaan: '' }), 'pekerjaan')).toBeTruthy();
    });
    (0, vitest_1.it)('menolak keranjang kosong', () => {
        (0, vitest_1.expect)(pesan((0, validasi_1.validasiPengajuan)({ ...sah, alatIds: [] }), 'alatIds')).toMatch(/satu alat/);
    });
    (0, vitest_1.it)('menolak alat yang terpilih dua kali', () => {
        (0, vitest_1.expect)(pesan((0, validasi_1.validasiPengajuan)({ ...sah, alatIds: [3, 3] }), 'alatIds')).toMatch(/sekali/);
    });
    (0, vitest_1.it)('menolak tanggal selesai yang mendahului tanggal mulai', () => {
        const hasil = (0, validasi_1.validasiPengajuan)({ ...sah, tanggalSelesai: '2026-08-31' });
        (0, vitest_1.expect)(pesan(hasil, 'tanggalSelesai')).toMatch(/mendahului/);
    });
    (0, vitest_1.it)('menerima tanggal mulai dan selesai yang sama', () => {
        (0, vitest_1.expect)((0, validasi_1.validasiPengajuan)({ ...sah, tanggalSelesai: sah.tanggalMulai })).toEqual([]);
    });
    (0, vitest_1.it)('menolak format tanggal yang bukan YYYY-MM-DD', () => {
        (0, vitest_1.expect)(pesan((0, validasi_1.validasiPengajuan)({ ...sah, tanggalMulai: '01-09-2026' }), 'tanggalMulai'))
            .toBeTruthy();
    });
    (0, vitest_1.it)('mengumpulkan seluruh pelanggaran sekaligus', () => {
        // Pengguna melihat semua yang kurang sekali jalan, bukan satu per satu.
        const hasil = (0, validasi_1.validasiPengajuan)({
            pekerjaan: '',
            nomorWo: '',
            tanggalMulai: '',
            tanggalSelesai: '',
            alatIds: [],
        });
        (0, vitest_1.expect)(hasil.length).toBeGreaterThanOrEqual(5);
    });
});
(0, vitest_1.describe)('ringkasDugaanKembar', () => {
    (0, vitest_1.it)('tidak berpesan bila tidak ada dugaan', () => {
        (0, vitest_1.expect)((0, validasi_1.ringkasDugaanKembar)([])).toBeNull();
    });
    (0, vitest_1.it)('menyebut alat dan nomor pengajuan yang bentrok', () => {
        const pesanKembar = (0, validasi_1.ringkasDugaanKembar)([
            { alatId: 1, namaAlat: 'Vibration Meter', peminjamanId: 42, status: 'SENT' },
        ]);
        (0, vitest_1.expect)(pesanKembar).toContain('Vibration Meter');
        (0, vitest_1.expect)(pesanKembar).toContain('#42');
        (0, vitest_1.expect)(pesanKembar).toContain('SENT');
    });
});
//# sourceMappingURL=validasi.test.js.map