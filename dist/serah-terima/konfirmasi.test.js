"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const konfirmasi_1 = require("./konfirmasi");
const RAHASIA = 'rahasia-uji-serah-terima-yang-panjang';
(0, vitest_1.describe)('kode konfirmasi', () => {
    (0, vitest_1.it)('selalu enam digit', () => {
        for (let i = 0; i < 50; i += 1) {
            (0, vitest_1.expect)((0, konfirmasi_1.buatKodeKonfirmasi)()).toMatch(/^\d{6}$/);
        }
    });
    (0, vitest_1.it)('menerima kode yang benar', () => {
        (0, vitest_1.expect)((0, konfirmasi_1.kodeCocok)('123456', '123456')).toBe(true);
    });
    (0, vitest_1.it)('menolak kode yang salah', () => {
        (0, vitest_1.expect)((0, konfirmasi_1.kodeCocok)('123456', '654321')).toBe(false);
    });
    (0, vitest_1.it)('menolak bila belum ada kode tersimpan', () => {
        (0, vitest_1.expect)((0, konfirmasi_1.kodeCocok)('123456', null)).toBe(false);
    });
    (0, vitest_1.it)('mengabaikan spasi di tepi', () => {
        (0, vitest_1.expect)((0, konfirmasi_1.kodeCocok)('  123456  ', '123456')).toBe(true);
    });
});
(0, vitest_1.describe)('tautan sekali-ketuk', () => {
    (0, vitest_1.it)('dapat dibaca kembali oleh pemegang kunci yang sama', () => {
        const token = (0, konfirmasi_1.buatTautan)({ serahTerimaId: 12, penerimaId: 34 }, RAHASIA);
        const hasil = (0, konfirmasi_1.bacaTautan)(token, RAHASIA);
        (0, vitest_1.expect)(hasil.sah).toBe(true);
        (0, vitest_1.expect)(hasil.isi).toMatchObject({ serahTerimaId: 12, penerimaId: 34 });
    });
    (0, vitest_1.it)('menolak tautan yang tanda tangannya diubah', () => {
        const token = (0, konfirmasi_1.buatTautan)({ serahTerimaId: 12, penerimaId: 34 }, RAHASIA);
        const dipalsu = `${token.slice(0, -4)}AAAA`;
        (0, vitest_1.expect)((0, konfirmasi_1.bacaTautan)(dipalsu, RAHASIA).sah).toBe(false);
    });
    (0, vitest_1.it)('menolak tautan yang isinya diubah', () => {
        // Mengganti nomor serah terima agar menunjuk milik orang lain.
        const token = (0, konfirmasi_1.buatTautan)({ serahTerimaId: 12, penerimaId: 34 }, RAHASIA);
        const [, penerima, kedaluwarsa, tanda] = token.split('.');
        (0, vitest_1.expect)((0, konfirmasi_1.bacaTautan)(`99.${penerima}.${kedaluwarsa}.${tanda}`, RAHASIA).sah).toBe(false);
    });
    (0, vitest_1.it)('menolak tautan dari kunci lain', () => {
        const token = (0, konfirmasi_1.buatTautan)({ serahTerimaId: 12, penerimaId: 34 }, 'kunci-lain-sama-panjangnya');
        (0, vitest_1.expect)((0, konfirmasi_1.bacaTautan)(token, RAHASIA).sah).toBe(false);
    });
    (0, vitest_1.it)('menolak tautan kedaluwarsa', () => {
        const token = (0, konfirmasi_1.buatTautan)({ serahTerimaId: 1, penerimaId: 2 }, RAHASIA);
        const [s, p, , t] = token.split('.');
        (0, vitest_1.expect)((0, konfirmasi_1.bacaTautan)(`${s}.${p}.1000.${t}`, RAHASIA).sah).toBe(false);
    });
    (0, vitest_1.it)('menolak bentuk yang bukan tautan', () => {
        (0, vitest_1.expect)((0, konfirmasi_1.bacaTautan)('sembarang', RAHASIA).sah).toBe(false);
    });
});
(0, vitest_1.describe)('periksaMetode', () => {
    (0, vitest_1.it)('peminjam boleh memakai tautan dan kode', () => {
        (0, vitest_1.expect)((0, konfirmasi_1.periksaMetode)('TAUTAN', false, null).boleh).toBe(true);
        (0, vitest_1.expect)((0, konfirmasi_1.periksaMetode)('KODE', false, null).boleh).toBe(true);
    });
    (0, vitest_1.it)('tanda tangan di layar hanya untuk pengelola', () => {
        // Layar itu berada di perangkat petugas, bukan perangkat peminjam.
        (0, vitest_1.expect)((0, konfirmasi_1.periksaMetode)('TANDA_TANGAN', false, null).boleh).toBe(false);
        (0, vitest_1.expect)((0, konfirmasi_1.periksaMetode)('TANDA_TANGAN', true, null).boleh).toBe(true);
    });
    (0, vitest_1.it)('konfirmasi oleh petugas wajib beralasan', () => {
        const tanpa = (0, konfirmasi_1.periksaMetode)('PETUGAS', true, null);
        (0, vitest_1.expect)(tanpa.boleh).toBe(false);
        (0, vitest_1.expect)(tanpa.alasan).toMatch(/alasan/);
        (0, vitest_1.expect)((0, konfirmasi_1.periksaMetode)('PETUGAS', true, 'Peminjam sedang di lapangan').boleh).toBe(true);
    });
    (0, vitest_1.it)('petugas bukan pengelola tetap ditolak meski beralasan', () => {
        (0, vitest_1.expect)((0, konfirmasi_1.periksaMetode)('PETUGAS', false, 'apa pun').boleh).toBe(false);
    });
});
(0, vitest_1.describe)('statusSetelahTerima', () => {
    (0, vitest_1.it)('RECEIVED hanya bila seluruh alat dikonfirmasi', () => {
        (0, vitest_1.expect)((0, konfirmasi_1.statusSetelahTerima)(3, 3, 'KIRIM')).toBe('RECEIVED');
    });
    (0, vitest_1.it)('PARTIAL RECEIVED bila masih ada sisa', () => {
        // Aturan lama dipertahankan apa adanya (PRD 8.2).
        (0, vitest_1.expect)((0, konfirmasi_1.statusSetelahTerima)(3, 2, 'KIRIM')).toBe('PARTIAL RECEIVED');
    });
    (0, vitest_1.it)('arah kembali memakai pasangan status yang sesuai', () => {
        (0, vitest_1.expect)((0, konfirmasi_1.statusSetelahTerima)(2, 2, 'KEMBALI')).toBe('RETURN');
        (0, vitest_1.expect)((0, konfirmasi_1.statusSetelahTerima)(2, 1, 'KEMBALI')).toBe('PARTIAL RETURN');
    });
    (0, vitest_1.it)('tidak terganggu bila hitungan melebihi jumlah alat', () => {
        (0, vitest_1.expect)((0, konfirmasi_1.statusSetelahTerima)(2, 5, 'KIRIM')).toBe('RECEIVED');
    });
});
(0, vitest_1.describe)('status setelah alat diserahkan', () => {
    (0, vitest_1.it)('SENT bila seluruh alat pengajuan diserahkan', () => {
        (0, vitest_1.expect)((0, konfirmasi_1.statusSetelahSerah)(3, 3, 'KIRIM')).toBe('SENT');
    });
    (0, vitest_1.it)('PARTIAL SENT bila sebagian alat masih di gudang', () => {
        (0, vitest_1.expect)((0, konfirmasi_1.statusSetelahSerah)(3, 2, 'KIRIM')).toBe('PARTIAL SENT');
    });
    (0, vitest_1.it)('pengembalian mengikuti pola yang sama', () => {
        (0, vitest_1.expect)((0, konfirmasi_1.statusSetelahSerah)(2, 2, 'KEMBALI')).toBe('RETURN');
        (0, vitest_1.expect)((0, konfirmasi_1.statusSetelahSerah)(2, 1, 'KEMBALI')).toBe('PARTIAL RETURN');
    });
});
(0, vitest_1.describe)('alamat tautan konfirmasi', () => {
    (0, vitest_1.it)('menyusun alamat halaman tanpa login', () => {
        (0, vitest_1.expect)((0, konfirmasi_1.alamatTautan)('https://iptools.contoh.id', '12.34.99.abc')).toBe('https://iptools.contoh.id/k/12.34.99.abc');
    });
    (0, vitest_1.it)('tidak menggandakan garis miring', () => {
        (0, vitest_1.expect)((0, konfirmasi_1.alamatTautan)('http://localhost:5173/', 'x')).toBe('http://localhost:5173/k/x');
    });
    (0, vitest_1.it)('meloloskan karakter khusus pada token', () => {
        (0, vitest_1.expect)((0, konfirmasi_1.alamatTautan)('http://a', 'a b')).toBe('http://a/k/a%20b');
    });
});
(0, vitest_1.describe)('penilaian kondisi sebelum diserahkan', () => {
    (0, vitest_1.it)('semua alat sudah dinilai: tidak ada yang tertahan', () => {
        (0, vitest_1.expect)((0, konfirmasi_1.alatBelumDinilai)([1, 2, 3], new Set([1, 2, 3]))).toEqual([]);
    });
    (0, vitest_1.it)('mengembalikan alat yang belum dinilai', () => {
        (0, vitest_1.expect)((0, konfirmasi_1.alatBelumDinilai)([1, 2, 3], new Set([2]))).toEqual([1, 3]);
    });
    (0, vitest_1.it)('penilaian alat lain tidak ikut dihitung', () => {
        (0, vitest_1.expect)((0, konfirmasi_1.alatBelumDinilai)([5], new Set([1, 2]))).toEqual([5]);
    });
});
(0, vitest_1.describe)('tahap penilaian yang disyaratkan', () => {
    (0, vitest_1.it)('kirim mensyaratkan tahap SENT', () => {
        (0, vitest_1.expect)((0, konfirmasi_1.syaratPenilaian)('KIRIM', 2)).toMatchObject({ tahap: 'SENT', code: 'PENILAIAN_KIRIM_BELUM' });
    });
    (0, vitest_1.it)('kembali mensyaratkan tahap RETURN', () => {
        (0, vitest_1.expect)((0, konfirmasi_1.syaratPenilaian)('KEMBALI', 2)).toMatchObject({ tahap: 'RETURN', code: 'PENILAIAN_KEMBALI_BELUM' });
    });
    (0, vitest_1.it)('pesan menyebut jumlah alat yang tertahan', () => {
        (0, vitest_1.expect)((0, konfirmasi_1.syaratPenilaian)('KEMBALI', 3).message).toMatch(/^3 alat/);
    });
});
//# sourceMappingURL=konfirmasi.test.js.map