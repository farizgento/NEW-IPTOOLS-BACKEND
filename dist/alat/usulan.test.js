"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const usulan_1 = require("./usulan");
(0, vitest_1.describe)('saringIsi', () => {
    (0, vitest_1.it)('membawa bidang yang dikenal', () => {
        (0, vitest_1.expect)((0, usulan_1.saringIsi)({ nama: 'Kunci Torsi', nilaiKontrak: 5_000_000 })).toEqual({
            nama: 'Kunci Torsi',
            nilaiKontrak: 5_000_000,
        });
    });
    (0, vitest_1.it)('membuang bidang yang tidak dikenal', () => {
        // Pagar keamanan: nama kolom tidak dapat diikat sebagai parameter SQL,
        // jadi bidang di luar daftar tidak boleh sampai ke pernyataan UPDATE.
        const hasil = (0, usulan_1.saringIsi)({ nama: 'X', 'id = 1; DROP TABLE alat; --': 'y', dihapus_pada: 'z' });
        (0, vitest_1.expect)(Object.keys(hasil)).toEqual(['nama']);
    });
    (0, vitest_1.it)('membuang nilai yang bukan teks atau angka', () => {
        (0, vitest_1.expect)((0, usulan_1.saringIsi)({ nama: { jahat: true }, unitId: [1, 2] })).toEqual({});
    });
    (0, vitest_1.it)('mempertahankan null sebagai niat mengosongkan', () => {
        (0, vitest_1.expect)((0, usulan_1.saringIsi)({ kodeMaximo: null })).toEqual({ kodeMaximo: null });
    });
});
(0, vitest_1.describe)('validasiUsulan', () => {
    (0, vitest_1.it)('menolak usulan ubah tanpa perubahan', () => {
        (0, vitest_1.expect)((0, usulan_1.validasiUsulan)('UBAH', {})).toHaveLength(1);
    });
    (0, vitest_1.it)('usulan hapus tidak butuh isi', () => {
        (0, vitest_1.expect)((0, usulan_1.validasiUsulan)('HAPUS', {})).toEqual([]);
    });
    (0, vitest_1.it)('menolak nama yang dikosongkan', () => {
        (0, vitest_1.expect)((0, usulan_1.validasiUsulan)('UBAH', { nama: '   ' })[0]?.field).toBe('nama');
    });
    (0, vitest_1.it)('menolak angka negatif', () => {
        (0, vitest_1.expect)((0, usulan_1.validasiUsulan)('UBAH', { nilaiKontrak: -1 })[0]?.field).toBe('nilaiKontrak');
    });
    (0, vitest_1.it)('menolak tahun perolehan yang tidak masuk akal', () => {
        (0, vitest_1.expect)((0, usulan_1.validasiUsulan)('UBAH', { tahunPerolehan: 1800 })[0]?.field).toBe('tahunPerolehan');
    });
    (0, vitest_1.it)('menerima perubahan yang wajar', () => {
        (0, vitest_1.expect)((0, usulan_1.validasiUsulan)('UBAH', { nama: 'Megger 5kV', tahunPerolehan: 2019 })).toEqual([]);
    });
});
(0, vitest_1.describe)('bolehMengusulkan', () => {
    (0, vitest_1.it)('mengizinkan bila tidak ada usulan menunggu', () => {
        (0, vitest_1.expect)((0, usulan_1.bolehMengusulkan)(0)).toBeNull();
    });
    (0, vitest_1.it)('menolak usulan kedua selagi yang pertama menunggu', () => {
        (0, vitest_1.expect)((0, usulan_1.bolehMengusulkan)(1)?.message).toMatch(/menunggu/);
    });
});
(0, vitest_1.describe)('periksaKeputusan', () => {
    const dasar = { statusSaatIni: 'WAITING APPROVAL', keputusan: 'SETUJU', adalahPemutusSah: true };
    (0, vitest_1.it)('mengizinkan pemutus sah menyetujui usulan yang menunggu', () => {
        (0, vitest_1.expect)((0, usulan_1.periksaKeputusan)(dasar).boleh).toBe(true);
    });
    (0, vitest_1.it)('menolak pemutus yang bukan admin super', () => {
        // Sistem lama tidak memeriksa ini sama sekali.
        (0, vitest_1.expect)((0, usulan_1.periksaKeputusan)({ ...dasar, adalahPemutusSah: false }).boleh).toBe(false);
    });
    (0, vitest_1.it)('menolak keputusan ganda', () => {
        const hasil = (0, usulan_1.periksaKeputusan)({ ...dasar, statusSaatIni: 'APPROVE' });
        (0, vitest_1.expect)(hasil.boleh).toBe(false);
        (0, vitest_1.expect)(hasil.alasan).toMatch(/sudah diputuskan/);
    });
    (0, vitest_1.it)('menuntut alasan saat menolak', () => {
        (0, vitest_1.expect)((0, usulan_1.periksaKeputusan)({ ...dasar, keputusan: 'TOLAK' }).boleh).toBe(false);
        (0, vitest_1.expect)((0, usulan_1.periksaKeputusan)({ ...dasar, keputusan: 'TOLAK', alasan: 'Kode barcode keliru' }).boleh).toBe(true);
    });
});
(0, vitest_1.describe)('statusRiwayat', () => {
    (0, vitest_1.it)('mencatat persetujuan sebagai APPROVE', () => {
        (0, vitest_1.expect)((0, usulan_1.statusRiwayat)('SETUJU')).toBe('APPROVE');
    });
    (0, vitest_1.it)('mencatat penolakan sebagai REJECT, bukan APPROVE', () => {
        // Procedure lama menulis 'APPROVE' untuk semua keputusan: 35 penolakan
        // tercatat sebagai persetujuan di data produksi.
        (0, vitest_1.expect)((0, usulan_1.statusRiwayat)('TOLAK')).toBe('REJECT');
    });
});
(0, vitest_1.describe)('susunPerubahan', () => {
    (0, vitest_1.it)('memetakan bidang ke kolom dan mengikat nilainya', () => {
        const { set, ikatan } = (0, usulan_1.susunPerubahan)({ nama: 'Baru', unitId: 3 });
        (0, vitest_1.expect)(set).toBe('nama = :nama, unit_id = :unitId');
        (0, vitest_1.expect)(ikatan).toEqual({ nama: 'Baru', unitId: 3 });
    });
    (0, vitest_1.it)('mengubah teks kosong menjadi null', () => {
        (0, vitest_1.expect)((0, usulan_1.susunPerubahan)({ kodeMaximo: '' }).ikatan).toEqual({ kodeMaximo: null });
    });
    (0, vitest_1.it)('tidak pernah menyisipkan nilai ke dalam teks SQL', () => {
        const { set } = (0, usulan_1.susunPerubahan)({ nama: "'; DROP TABLE alat; --" });
        (0, vitest_1.expect)(set).toBe('nama = :nama');
        (0, vitest_1.expect)(set).not.toContain('DROP');
    });
});
(0, vitest_1.describe)('bakukanIsiLama', () => {
    const peta = { 'jenisId:lifting tools': 3, 'kondisiId:rusak': 7, 'lokasiId:msu ks tubun': 11 };
    const cari = (b, n) => peta[`${b}:${n.trim().replace(/\s+/g, ' ').toLowerCase()}`];
    (0, vitest_1.it)('memetakan namaAlat dan nama referensi ke kolom baru', () => {
        const h = (0, usulan_1.bakukanIsiLama)({ namaAlat: ' BASE MON ', jenis: 'Lifting  Tools', kondisi: 'Rusak', lokasi: 'MSU KS Tubun', tahunPerolehan: 2018 }, cari);
        (0, vitest_1.expect)(h.isi).toEqual({ nama: 'BASE MON', jenisId: 3, kondisiId: 7, lokasiId: 11, tahunPerolehan: 2018 });
        (0, vitest_1.expect)(h.takTerpetakan).toEqual([]);
    });
    (0, vitest_1.it)('melaporkan nama yang tidak dikenal alih-alih membuangnya diam-diam', () => {
        const h = (0, usulan_1.bakukanIsiLama)({ kondisi: 'Hilang' }, cari);
        (0, vitest_1.expect)(h.isi).toEqual({});
        (0, vitest_1.expect)(h.takTerpetakan).toEqual(['kondisi "Hilang"']);
    });
    (0, vitest_1.it)('tidak menimpa kunci baru yang sudah ada', () => {
        const h = (0, usulan_1.bakukanIsiLama)({ nama: 'Baru', namaAlat: 'Lama', kondisiId: 1, kondisi: 'Rusak' }, cari);
        (0, vitest_1.expect)(h.isi).toEqual({ nama: 'Baru', kondisiId: 1 });
    });
    (0, vitest_1.it)('isi baru tetap utuh', () => {
        (0, vitest_1.expect)((0, usulan_1.bakukanIsiLama)({ nama: 'X', unitId: 2 }, cari)).toEqual({ isi: { nama: 'X', unitId: 2 }, takTerpetakan: [] });
    });
});
//# sourceMappingURL=usulan.test.js.map