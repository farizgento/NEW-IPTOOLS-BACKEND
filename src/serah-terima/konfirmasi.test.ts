import { describe, expect, it } from 'vitest';
import {
  bacaTautan,
  buatKodeKonfirmasi,
  buatTautan,
  kodeCocok,
  periksaMetode,
  statusSetelahTerima,
  statusSetelahSerah,
  alamatTautan,
  alatBelumDinilai,
  syaratPenilaian,
} from './konfirmasi';

const RAHASIA = 'rahasia-uji-serah-terima-yang-panjang';

describe('kode konfirmasi', () => {
  it('selalu enam digit', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(buatKodeKonfirmasi()).toMatch(/^\d{6}$/);
    }
  });

  it('menerima kode yang benar', () => {
    expect(kodeCocok('123456', '123456')).toBe(true);
  });

  it('menolak kode yang salah', () => {
    expect(kodeCocok('123456', '654321')).toBe(false);
  });

  it('menolak bila belum ada kode tersimpan', () => {
    expect(kodeCocok('123456', null)).toBe(false);
  });

  it('mengabaikan spasi di tepi', () => {
    expect(kodeCocok('  123456  ', '123456')).toBe(true);
  });
});

describe('tautan sekali-ketuk', () => {
  it('dapat dibaca kembali oleh pemegang kunci yang sama', () => {
    const token = buatTautan({ serahTerimaId: 12, penerimaId: 34 }, RAHASIA);
    const hasil = bacaTautan(token, RAHASIA);
    expect(hasil.sah).toBe(true);
    expect(hasil.isi).toMatchObject({ serahTerimaId: 12, penerimaId: 34 });
  });

  it('menolak tautan yang tanda tangannya diubah', () => {
    const token = buatTautan({ serahTerimaId: 12, penerimaId: 34 }, RAHASIA);
    const dipalsu = `${token.slice(0, -4)}AAAA`;
    expect(bacaTautan(dipalsu, RAHASIA).sah).toBe(false);
  });

  it('menolak tautan yang isinya diubah', () => {
    // Mengganti nomor serah terima agar menunjuk milik orang lain.
    const token = buatTautan({ serahTerimaId: 12, penerimaId: 34 }, RAHASIA);
    const [, penerima, kedaluwarsa, tanda] = token.split('.');
    expect(bacaTautan(`99.${penerima}.${kedaluwarsa}.${tanda}`, RAHASIA).sah).toBe(false);
  });

  it('menolak tautan dari kunci lain', () => {
    const token = buatTautan({ serahTerimaId: 12, penerimaId: 34 }, 'kunci-lain-sama-panjangnya');
    expect(bacaTautan(token, RAHASIA).sah).toBe(false);
  });

  it('menolak tautan kedaluwarsa', () => {
    const token = buatTautan({ serahTerimaId: 1, penerimaId: 2 }, RAHASIA);
    const [s, p, , t] = token.split('.');
    expect(bacaTautan(`${s}.${p}.1000.${t}`, RAHASIA).sah).toBe(false);
  });

  it('menolak bentuk yang bukan tautan', () => {
    expect(bacaTautan('sembarang', RAHASIA).sah).toBe(false);
  });
});

describe('periksaMetode', () => {
  it('peminjam boleh memakai tautan dan kode', () => {
    expect(periksaMetode('TAUTAN', false, null).boleh).toBe(true);
    expect(periksaMetode('KODE', false, null).boleh).toBe(true);
  });

  it('tanda tangan di layar hanya untuk pengelola', () => {
    // Layar itu berada di perangkat petugas, bukan perangkat peminjam.
    expect(periksaMetode('TANDA_TANGAN', false, null).boleh).toBe(false);
    expect(periksaMetode('TANDA_TANGAN', true, null).boleh).toBe(true);
  });

  it('konfirmasi oleh petugas wajib beralasan', () => {
    const tanpa = periksaMetode('PETUGAS', true, null);
    expect(tanpa.boleh).toBe(false);
    expect(tanpa.alasan).toMatch(/alasan/);
    expect(periksaMetode('PETUGAS', true, 'Peminjam sedang di lapangan').boleh).toBe(true);
  });

  it('petugas bukan pengelola tetap ditolak meski beralasan', () => {
    expect(periksaMetode('PETUGAS', false, 'apa pun').boleh).toBe(false);
  });
});

describe('statusSetelahTerima', () => {
  it('RECEIVED hanya bila seluruh alat dikonfirmasi', () => {
    expect(statusSetelahTerima(3, 3, 'KIRIM')).toBe('RECEIVED');
  });

  it('PARTIAL RECEIVED bila masih ada sisa', () => {
    // Aturan lama dipertahankan apa adanya (PRD 8.2).
    expect(statusSetelahTerima(3, 2, 'KIRIM')).toBe('PARTIAL RECEIVED');
  });

  it('arah kembali memakai pasangan status yang sesuai', () => {
    expect(statusSetelahTerima(2, 2, 'KEMBALI')).toBe('RETURN');
    expect(statusSetelahTerima(2, 1, 'KEMBALI')).toBe('PARTIAL RETURN');
  });

  it('tidak terganggu bila hitungan melebihi jumlah alat', () => {
    expect(statusSetelahTerima(2, 5, 'KIRIM')).toBe('RECEIVED');
  });
});

describe('status setelah alat diserahkan', () => {
  it('SENT bila seluruh alat pengajuan diserahkan', () => {
    expect(statusSetelahSerah(3, 3, 'KIRIM')).toBe('SENT');
  });

  it('PARTIAL SENT bila sebagian alat masih di gudang', () => {
    expect(statusSetelahSerah(3, 2, 'KIRIM')).toBe('PARTIAL SENT');
  });

  it('pengembalian mengikuti pola yang sama', () => {
    expect(statusSetelahSerah(2, 2, 'KEMBALI')).toBe('RETURN');
    expect(statusSetelahSerah(2, 1, 'KEMBALI')).toBe('PARTIAL RETURN');
  });
});

describe('alamat tautan konfirmasi', () => {
  it('menyusun alamat halaman tanpa login', () => {
    expect(alamatTautan('https://iptools.contoh.id', '12.34.99.abc')).toBe('https://iptools.contoh.id/k/12.34.99.abc');
  });

  it('tidak menggandakan garis miring', () => {
    expect(alamatTautan('http://localhost:5173/', 'x')).toBe('http://localhost:5173/k/x');
  });

  it('meloloskan karakter khusus pada token', () => {
    expect(alamatTautan('http://a', 'a b')).toBe('http://a/k/a%20b');
  });
});

describe('penilaian kondisi sebelum diserahkan', () => {
  it('semua alat sudah dinilai: tidak ada yang tertahan', () => {
    expect(alatBelumDinilai([1, 2, 3], new Set([1, 2, 3]))).toEqual([]);
  });

  it('mengembalikan alat yang belum dinilai', () => {
    expect(alatBelumDinilai([1, 2, 3], new Set([2]))).toEqual([1, 3]);
  });

  it('penilaian alat lain tidak ikut dihitung', () => {
    expect(alatBelumDinilai([5], new Set([1, 2]))).toEqual([5]);
  });
});

describe('tahap penilaian yang disyaratkan', () => {
  it('kirim mensyaratkan tahap SENT', () => {
    expect(syaratPenilaian('KIRIM', 2)).toMatchObject({ tahap: 'SENT', code: 'PENILAIAN_KIRIM_BELUM' });
  });

  it('kembali mensyaratkan tahap RETURN', () => {
    expect(syaratPenilaian('KEMBALI', 2)).toMatchObject({ tahap: 'RETURN', code: 'PENILAIAN_KEMBALI_BELUM' });
  });

  it('pesan menyebut jumlah alat yang tertahan', () => {
    expect(syaratPenilaian('KEMBALI', 3).message).toMatch(/^3 alat/);
  });
});
