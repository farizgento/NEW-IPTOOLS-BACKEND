"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const berkas_1 = require("./berkas");
const sah = { namaAsli: 'foto.jpg', tipeMedia: 'image/jpeg', ukuran: 1024 };
(0, vitest_1.describe)('validasiBerkas', () => {
    (0, vitest_1.it)('menerima gambar dan PDF dalam batas ukuran', () => {
        (0, vitest_1.expect)((0, berkas_1.validasiBerkas)(sah, berkas_1.UKURAN_MAKS_BAWAAN)).toEqual([]);
        (0, vitest_1.expect)((0, berkas_1.validasiBerkas)({ namaAsli: 'a.pdf', tipeMedia: 'application/pdf', ukuran: 500 }, berkas_1.UKURAN_MAKS_BAWAAN)).toEqual([]);
    });
    (0, vitest_1.it)('menolak berkas kosong', () => {
        (0, vitest_1.expect)((0, berkas_1.validasiBerkas)({ ...sah, ukuran: 0 }, berkas_1.UKURAN_MAKS_BAWAAN)).not.toEqual([]);
    });
    (0, vitest_1.it)('menolak berkas yang melebihi batas', () => {
        const hasil = (0, berkas_1.validasiBerkas)({ ...sah, ukuran: berkas_1.UKURAN_MAKS_BAWAAN + 1 }, berkas_1.UKURAN_MAKS_BAWAAN);
        (0, vitest_1.expect)(hasil[0]?.message).toMatch(/melebihi/);
    });
    (0, vitest_1.it)('menolak tipe yang tidak diterima', () => {
        // Berkas yang dapat dieksekusi tidak boleh masuk penyimpanan.
        const hasil = (0, berkas_1.validasiBerkas)({ namaAsli: 'jahat.exe', tipeMedia: 'application/x-msdownload', ukuran: 10 }, berkas_1.UKURAN_MAKS_BAWAAN);
        (0, vitest_1.expect)(hasil[0]?.message).toMatch(/tidak diterima/);
    });
    (0, vitest_1.it)('menolak html yang dapat dijalankan peramban', () => {
        const hasil = (0, berkas_1.validasiBerkas)({ namaAsli: 'x.html', tipeMedia: 'text/html', ukuran: 10 }, berkas_1.UKURAN_MAKS_BAWAAN);
        (0, vitest_1.expect)(hasil).not.toEqual([]);
    });
});
(0, vitest_1.describe)('namaSimpan', () => {
    (0, vitest_1.it)('memakai akhiran dari tipe media, bukan dari nama pengunggah', () => {
        (0, vitest_1.expect)((0, berkas_1.namaSimpan)('image/png')).toMatch(/^[0-9a-f-]{36}\.png$/);
        (0, vitest_1.expect)((0, berkas_1.namaSimpan)('application/pdf')).toMatch(/\.pdf$/);
    });
    (0, vitest_1.it)('tidak pernah menghasilkan nama yang sama', () => {
        const kumpulan = new Set(Array.from({ length: 200 }, () => (0, berkas_1.namaSimpan)('image/jpeg')));
        (0, vitest_1.expect)(kumpulan.size).toBe(200);
    });
});
(0, vitest_1.describe)('bersihkanNamaAsli', () => {
    (0, vitest_1.it)('membuang bagian jalur pada nama unggahan', () => {
        // Nama semacam ini yang membawa berkas keluar dari direktori penyimpanan.
        (0, vitest_1.expect)((0, berkas_1.bersihkanNamaAsli)('../../etc/passwd')).toBe('passwd');
        (0, vitest_1.expect)((0, berkas_1.bersihkanNamaAsli)('..\\windows\\system32\\cmd.exe')).toBe('cmd.exe');
    });
    (0, vitest_1.it)('membuang karakter yang bermasalah di sistem berkas', () => {
        (0, vitest_1.expect)((0, berkas_1.bersihkanNamaAsli)('lap:oran"uji?.pdf')).toBe('lap_oran_uji_.pdf');
    });
    (0, vitest_1.it)('memberi nama cadangan bila hasilnya kosong', () => {
        (0, vitest_1.expect)((0, berkas_1.bersihkanNamaAsli)('///')).toBe('berkas');
    });
    (0, vitest_1.it)('memotong nama yang terlalu panjang', () => {
        (0, vitest_1.expect)((0, berkas_1.bersihkanNamaAsli)('a'.repeat(400)).length).toBe(255);
    });
});
(0, vitest_1.describe)('akhiranCocok', () => {
    (0, vitest_1.it)('menerima jpg dan jpeg untuk image/jpeg', () => {
        (0, vitest_1.expect)((0, berkas_1.akhiranCocok)('foto.jpg', 'image/jpeg')).toBe(true);
        (0, vitest_1.expect)((0, berkas_1.akhiranCocok)('foto.jpeg', 'image/jpeg')).toBe(true);
    });
    (0, vitest_1.it)('menolak akhiran yang tidak sesuai tipenya', () => {
        // Berkas exe yang menyamar sebagai gambar.
        (0, vitest_1.expect)((0, berkas_1.akhiranCocok)('gambar.exe', 'image/png')).toBe(false);
    });
    (0, vitest_1.it)('menerima nama tanpa akhiran', () => {
        (0, vitest_1.expect)((0, berkas_1.akhiranCocok)('berkas', 'application/pdf')).toBe(true);
    });
});
(0, vitest_1.describe)('lokasiRelatif', () => {
    (0, vitest_1.it)('memisahkan penyimpanan per entitas dan nomornya', () => {
        (0, vitest_1.expect)((0, berkas_1.lokasiRelatif)('KERUSAKAN', 42, 'abc.jpg')).toBe('kerusakan/42/abc.jpg');
    });
});
(0, vitest_1.describe)('isiCocok', () => {
    const b = (...x) => Uint8Array.from(x);
    const s = (t) => Uint8Array.from([...t].map((c) => c.charCodeAt(0)));
    (0, vitest_1.it)('mengenali tanda tangan gambar dan PDF', () => {
        (0, vitest_1.expect)((0, berkas_1.isiCocok)(b(0xff, 0xd8, 0xff, 0xe0), 'image/jpeg')).toBe(true);
        (0, vitest_1.expect)((0, berkas_1.isiCocok)(b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), 'image/png')).toBe(true);
        (0, vitest_1.expect)((0, berkas_1.isiCocok)(s('RIFF\0\0\0\0WEBPVP8 '), 'image/webp')).toBe(true);
        (0, vitest_1.expect)((0, berkas_1.isiCocok)(s('%PDF-1.7'), 'application/pdf')).toBe(true);
    });
    (0, vitest_1.it)('menolak halaman HTML yang mengaku PDF atau gambar', () => {
        (0, vitest_1.expect)((0, berkas_1.isiCocok)(s('<html><script>'), 'application/pdf')).toBe(false);
        (0, vitest_1.expect)((0, berkas_1.isiCocok)(s('<svg onload=1>'), 'image/png')).toBe(false);
    });
    (0, vitest_1.it)('menolak isi yang terlalu pendek', () => {
        (0, vitest_1.expect)((0, berkas_1.isiCocok)(b(0xff), 'image/jpeg')).toBe(false);
    });
});
(0, vitest_1.describe)('periksaTujuan', () => {
    (0, vitest_1.it)('foto alat hanya boleh gambar', () => {
        (0, vitest_1.expect)((0, berkas_1.periksaTujuan)('ALAT', 'GAMBAR', 'image/png', ['PENGELOLA'])).toBeNull();
        (0, vitest_1.expect)((0, berkas_1.periksaTujuan)('ALAT', 'GAMBAR', 'application/pdf', ['PENGELOLA'])?.kode).toBe('TIPE');
    });
    (0, vitest_1.it)('manual dan sertifikat menerima PDF', () => {
        (0, vitest_1.expect)((0, berkas_1.periksaTujuan)('ALAT', 'MANUAL', 'application/pdf', ['ADMIN_UNIT'])).toBeNull();
        (0, vitest_1.expect)((0, berkas_1.periksaTujuan)('ALAT_SERTIFIKAT', 'SERTIFIKAT', 'application/pdf', ['ADMIN_SUPER'])).toBeNull();
    });
    (0, vitest_1.it)('menolak peminjam biasa mengubah berkas master data', () => {
        (0, vitest_1.expect)((0, berkas_1.periksaTujuan)('ALAT', 'GAMBAR', 'image/png', ['PEMINJAM'])?.kode).toBe('PERAN');
        (0, vitest_1.expect)((0, berkas_1.periksaTujuan)('ALAT_SERTIFIKAT', 'SERTIFIKAT', null, ['STAF'])?.kode).toBe('PERAN');
    });
    (0, vitest_1.it)('menolak jenis yang tidak dikenal', () => {
        (0, vitest_1.expect)((0, berkas_1.periksaTujuan)('ALAT', 'SERTIFIKAT', 'application/pdf', ['PENGELOLA'])?.kode).toBe('JENIS');
    });
    (0, vitest_1.it)('entitas alur lain tidak diatur di sini', () => {
        (0, vitest_1.expect)((0, berkas_1.periksaTujuan)('SERAH_TERIMA', 'TANDA_TANGAN', 'image/png', ['PEMINJAM'])).toBeNull();
    });
});
//# sourceMappingURL=berkas.test.js.map