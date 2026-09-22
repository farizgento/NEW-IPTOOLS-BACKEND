import { describe, expect, it } from 'vitest';
import { ambilTokenDariHeader, terbitkanToken, verifikasiToken } from './token';

const RAHASIA = 'rahasia-uji-yang-cukup-panjang-untuk-hs256';

describe('token', () => {
  it('menerbitkan lalu memverifikasi token yang sama', () => {
    const token = terbitkanToken({ sub: 42, peran: ['PENGELOLA'], unitId: 7 }, RAHASIA, 60);
    const hasil = verifikasiToken(token, RAHASIA);
    expect(hasil.sah).toBe(true);
    expect(hasil.isi).toMatchObject({ sub: 42, peran: ['PENGELOLA'], unitId: 7 });
  });

  it('menolak token yang ditandatangani kunci lain', () => {
    const token = terbitkanToken({ sub: 1, peran: [], unitId: null }, 'kunci-lain-yang-panjang-sekali', 60);
    expect(verifikasiToken(token, RAHASIA).sah).toBe(false);
  });

  it('menolak token kedaluwarsa', () => {
    const token = terbitkanToken({ sub: 1, peran: [], unitId: null }, RAHASIA, -1);
    const hasil = verifikasiToken(token, RAHASIA);
    expect(hasil.sah).toBe(false);
    expect(hasil.alasan).toContain('expired');
  });

  it('menolak teks sembarang', () => {
    expect(verifikasiToken('bukan-token', RAHASIA).sah).toBe(false);
  });
});

describe('ambilTokenDariHeader', () => {
  it('mengambil nilai setelah Bearer', () => {
    expect(ambilTokenDariHeader('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('tidak peduli besar kecil huruf pada kata Bearer', () => {
    expect(ambilTokenDariHeader('bearer abc')).toBe('abc');
  });

  it('mengabaikan skema selain Bearer', () => {
    expect(ambilTokenDariHeader('Basic abc')).toBeUndefined();
  });

  it('mengabaikan header kosong atau tidak lengkap', () => {
    expect(ambilTokenDariHeader(undefined)).toBeUndefined();
    expect(ambilTokenDariHeader('Bearer')).toBeUndefined();
  });
});
