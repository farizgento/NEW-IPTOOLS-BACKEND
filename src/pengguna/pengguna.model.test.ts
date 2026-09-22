import { describe, expect, it } from 'vitest';
import {
  bolehMasuk,
  kePengguna,
  punyaSalahSatuPeran,
  type BarisPengguna,
} from './pengguna.model';

function baris(ubah: Partial<BarisPengguna> = {}): BarisPengguna {
  return {
    ID: 1,
    NAMA: 'Budi Santoso',
    EMAIL: 'budi@contoh.local',
    USERNAME: 'BUDI',
    NIPEG: '123',
    UNIT_ID: 7,
    NAMA_UNIT: 'MSU',
    JABATAN: null,
    SUMBER_UNIT: 'MIGRASI',
    DUPLIKAT_DARI: null,
    NONAKTIF_PADA: null,
    PERAN: 'PENGELOLA,PEMINJAM',
    ...ubah,
  };
}

describe('kePengguna', () => {
  it('memecah daftar peran menjadi larik', () => {
    expect(kePengguna(baris()).peran).toEqual(['PENGELOLA', 'PEMINJAM']);
  });

  it('menghasilkan larik kosong bila pengguna tidak punya peran', () => {
    expect(kePengguna(baris({ PERAN: null })).peran).toEqual([]);
  });

  it('membuang nilai peran yang tidak dikenal', () => {
    // Menjaga dari nilai lama yang belum sempat dipetakan saat migrasi.
    expect(kePengguna(baris({ PERAN: 'PENGELOLA,SPTOOL' })).peran).toEqual(['PENGELOLA']);
  });

  it('menganggap baris duplikat sebagai tidak aktif', () => {
    // 113 baris hasil pencatatan berulang di sistem lama (PRD 7.3).
    expect(kePengguna(baris({ DUPLIKAT_DARI: 5 })).aktif).toBe(false);
  });

  it('menganggap baris yang dinonaktifkan sebagai tidak aktif', () => {
    expect(kePengguna(baris({ NONAKTIF_PADA: new Date() })).aktif).toBe(false);
  });

  it('membiarkan unit kosong apa adanya, tidak menebak', () => {
    const p = kePengguna(baris({ UNIT_ID: null, NAMA_UNIT: null, SUMBER_UNIT: null }));
    expect(p.unitId).toBeNull();
    expect(p.sumberUnit).toBeNull();
  });
});

describe('punyaSalahSatuPeran', () => {
  const pengguna = kePengguna(baris());

  it('benar bila salah satu peran cocok', () => {
    expect(punyaSalahSatuPeran(pengguna, ['MANAJER', 'PENGELOLA'])).toBe(true);
  });

  it('salah bila tidak ada yang cocok', () => {
    expect(punyaSalahSatuPeran(pengguna, ['ADMIN_SUPER'])).toBe(false);
  });

  it('benar bila tidak ada peran yang diminta', () => {
    expect(punyaSalahSatuPeran(pengguna, [])).toBe(true);
  });
});

describe('bolehMasuk', () => {
  it('mengizinkan pengguna aktif tanpa peran sekalipun', () => {
    // Pengguna tanpa peran tetap berhak melihat profilnya sendiri.
    expect(bolehMasuk(kePengguna(baris({ PERAN: null })))).toBe(true);
  });

  it('menolak baris duplikat', () => {
    expect(bolehMasuk(kePengguna(baris({ DUPLIKAT_DARI: 5 })))).toBe(false);
  });
});
