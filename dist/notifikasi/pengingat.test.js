"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const pengingat_1 = require("./pengingat");
const hari = (n) => new Date(2026, 0, 1 + n, 9, 0, 0);
const kirim = hari(0);
function jatuhTempo(umurHari, sudah = []) {
    return (0, pengingat_1.jenjangJatuhTempo)(kirim, hari(umurHari), sudah)?.jenjang;
}
(0, vitest_1.describe)('selisihHari', () => {
    (0, vitest_1.it)('menghitung selisih hari penuh', () => {
        (0, vitest_1.expect)((0, pengingat_1.selisihHari)(hari(0), hari(3))).toBe(3);
    });
    (0, vitest_1.it)('belum genap sehari dihitung nol', () => {
        const pagi = new Date(2026, 0, 1, 9, 0);
        const malam = new Date(2026, 0, 1, 23, 0);
        (0, vitest_1.expect)((0, pengingat_1.selisihHari)(pagi, malam)).toBe(0);
    });
});
(0, vitest_1.describe)('jenjangJatuhTempo', () => {
    (0, vitest_1.it)('belum ada pengingat di hari yang sama', () => {
        (0, vitest_1.expect)(jatuhTempo(0)).toBeUndefined();
    });
    (0, vitest_1.it)('H1 jatuh tempo setelah sehari', () => {
        (0, vitest_1.expect)(jatuhTempo(1)).toBe('H1');
    });
    (0, vitest_1.it)('H3 jatuh tempo setelah tiga hari', () => {
        (0, vitest_1.expect)(jatuhTempo(3, ['H1'])).toBe('H3');
    });
    (0, vitest_1.it)('H7 jatuh tempo setelah sepekan', () => {
        (0, vitest_1.expect)(jatuhTempo(7, ['H1', 'H3'])).toBe('H7');
    });
    (0, vitest_1.it)('tidak mengulang jenjang yang sudah dikirim', () => {
        (0, vitest_1.expect)(jatuhTempo(2, ['H1'])).toBeUndefined();
    });
    (0, vitest_1.it)('berhenti setelah jenjang terakhir', () => {
        (0, vitest_1.expect)(jatuhTempo(30, ['H1', 'H3', 'H7'])).toBeUndefined();
    });
    (0, vitest_1.it)('hanya mengirim satu pesan meski beberapa jenjang terlewat', () => {
        // Pengiriman yang baru diperiksa setelah sepuluh hari: penerimanya cukup
        // mendapat satu pesan, bukan tiga sekaligus.
        (0, vitest_1.expect)(jatuhTempo(10)).toBe('H7');
    });
    (0, vitest_1.it)('memilih jenjang tertinggi yang belum dikirim', () => {
        (0, vitest_1.expect)(jatuhTempo(5, ['H1'])).toBe('H3');
    });
    (0, vitest_1.it)('tidak mengirim jenjang yang lebih rendah setelah yang tinggi terkirim', () => {
        // Pengiriman berumur seribu hari yang baru diperiksa: setelah menerima H7,
        // pemeriksaan berikutnya tidak boleh menyusulkan H3 lalu H1 — itu mundur,
        // bukan mendesak.
        (0, vitest_1.expect)(jatuhTempo(1000, ['H7'])).toBeUndefined();
        (0, vitest_1.expect)(jatuhTempo(1000, ['H3'])).toBe('H7');
        (0, vitest_1.expect)(jatuhTempo(1000, ['H1'])).toBe('H7');
    });
    (0, vitest_1.it)('berhenti sepenuhnya setelah jenjang tertinggi terkirim', () => {
        (0, vitest_1.expect)(jatuhTempo(9999, ['H7'])).toBeUndefined();
    });
});
(0, vitest_1.describe)('pengingatPengembalian', () => {
    const selesai = hari(10);
    (0, vitest_1.it)('mengingatkan sehari sebelum jatuh tempo', () => {
        (0, vitest_1.expect)((0, pengingat_1.pengingatPengembalian)(selesai, hari(9), [])?.jenjang).toBe('JATUH_TEMPO');
    });
    (0, vitest_1.it)('mengingatkan pada hari jatuh tempo', () => {
        (0, vitest_1.expect)((0, pengingat_1.pengingatPengembalian)(selesai, hari(10), [])?.jenjang).toBe('JATUH_TEMPO');
    });
    (0, vitest_1.it)('diam bila masih lama', () => {
        (0, vitest_1.expect)((0, pengingat_1.pengingatPengembalian)(selesai, hari(3), [])).toBeUndefined();
    });
    (0, vitest_1.it)('menandai terlambat setelah lewat', () => {
        const hasil = (0, pengingat_1.pengingatPengembalian)(selesai, hari(13), ['JATUH_TEMPO']);
        (0, vitest_1.expect)(hasil?.jenjang).toBe('TERLAMBAT');
        (0, vitest_1.expect)(hasil?.perihal).toContain('3 hari');
    });
    (0, vitest_1.it)('tidak mengulang peringatan terlambat', () => {
        (0, vitest_1.expect)((0, pengingat_1.pengingatPengembalian)(selesai, hari(20), ['TERLAMBAT'])).toBeUndefined();
    });
});
(0, vitest_1.describe)('susunPesan', () => {
    const dasar = { namaPenerima: 'Budi', jumlahAlat: 3, nomorPeminjaman: 42, umurHari: 1 };
    (0, vitest_1.it)('menyebut "kemarin" untuk pengingat hari pertama', () => {
        const pesan = (0, pengingat_1.susunPesan)({ ...dasar, jenjang: 'H1' });
        (0, vitest_1.expect)(pesan).toContain('dikirim kemarin');
        (0, vitest_1.expect)(pesan).toContain('#42');
    });
    (0, vitest_1.it)('menyebut umur pengiriman untuk jenjang berikutnya', () => {
        (0, vitest_1.expect)((0, pengingat_1.susunPesan)({ ...dasar, jenjang: 'H7', umurHari: 7 })).toContain('7 hari lalu');
    });
    (0, vitest_1.it)('pesan keterlambatan tidak menyinggung konfirmasi', () => {
        const pesan = (0, pengingat_1.susunPesan)({ ...dasar, jenjang: 'TERLAMBAT' });
        (0, vitest_1.expect)(pesan).toContain('lewat tanggal pengembalian');
        (0, vitest_1.expect)(pesan).not.toContain('konfirmasi');
    });
    (0, vitest_1.it)('pesan jatuh tempo menyebut besok', () => {
        (0, vitest_1.expect)((0, pengingat_1.susunPesan)({ ...dasar, jenjang: 'JATUH_TEMPO' })).toContain('besok');
    });
});
//# sourceMappingURL=pengingat.test.js.map