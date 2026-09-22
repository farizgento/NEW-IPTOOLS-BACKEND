import { describe, expect, it } from 'vitest';
import { bacaKonfigurasi } from './konfigurasi';

const dasar = {
  DB_HOST: 'localhost',
  DB_SERVICE: 'XEPDB1',
  DB_USER: 'IPTOOLS_NEW',
  DB_PASSWORD: 'rahasia',
  JWT_RAHASIA: 'kunci-uji-yang-panjangnya-lebih-dari-32-karakter',
} as NodeJS.ProcessEnv;

describe('bacaKonfigurasi', () => {
  it('mengisi nilai bawaan yang wajar', () => {
    const k = bacaKonfigurasi(dasar);
    expect(k.PORT).toBe(3001);
    expect(k.DB_PORT).toBe(1521);
    expect(k.AUTH_LEWATI_DIREKTORI).toBe(false);
  });

  it('menolak kunci token yang terlalu pendek', () => {
    expect(() => bacaKonfigurasi({ ...dasar, JWT_RAHASIA: 'pendek' })).toThrow(/JWT_RAHASIA/);
  });

  it('menolak konfigurasi tanpa alamat basis data', () => {
    const { DB_HOST: _abaikan, ...tanpaHost } = dasar;
    expect(() => bacaKonfigurasi(tanpaHost)).toThrow(/DB_HOST/);
  });

  it('menolak jalan pintas autentikasi di produksi', () => {
    // Pengaman terpenting di berkas ini: jalur pintas tidak boleh ikut terbawa
    // ke lingkungan nyata karena kelalaian mengubah .env.
    expect(() =>
      bacaKonfigurasi({ ...dasar, NODE_ENV: 'production', AUTH_LEWATI_DIREKTORI: 'true' }),
    ).toThrow(/AUTH_LEWATI_DIREKTORI/);
  });

  it('mengizinkan jalan pintas di luar produksi', () => {
    const k = bacaKonfigurasi({ ...dasar, NODE_ENV: 'development', AUTH_LEWATI_DIREKTORI: 'true' });
    expect(k.AUTH_LEWATI_DIREKTORI).toBe(true);
  });
});
