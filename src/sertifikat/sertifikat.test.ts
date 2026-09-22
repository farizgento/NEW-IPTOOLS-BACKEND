import { describe, expect, it } from 'vitest';
import {
  bakukanHasil,
  kunciPelaksana,
  periksaSertifikat,
  saranSetahun,
  statusSertifikat,
  type IsiSertifikat,
} from './sertifikat';

const HARI_INI = '2026-09-21';

const isi = (ubah: Partial<IsiSertifikat> = {}): IsiSertifikat => ({
  nomor: '05552/GQI-Sert/06/26',
  tanggalKalibrasi: '2026-06-29',
  tanggalSaran: '2027-06-29',
  hasil: 'Baik',
  pelaksana: 'PT Global Quality Indonesia',
  ...ubah,
});

describe('statusSertifikat', () => {
  it('menandai kedaluwarsa ketika tanggal kalibrasi ulang sudah lewat', () => {
    expect(statusSertifikat('2026-03-31', HARI_INI)).toEqual({ status: 'LEWAT', sisaHari: -174 });
  });

  it('menandai segera habis dalam 90 hari', () => {
    expect(statusSertifikat('2026-10-01', HARI_INI).status).toBe('SEGERA');
    expect(statusSertifikat('2026-12-20', HARI_INI).status).toBe('SEGERA');
  });

  it('menandai berlaku bila masih lebih dari 90 hari', () => {
    expect(statusSertifikat('2027-06-29', HARI_INI).status).toBe('BERLAKU');
  });

  it('membedakan sertifikat tanpa tanggal kalibrasi ulang', () => {
    expect(statusSertifikat(null, HARI_INI)).toEqual({ status: 'TANPA_TANGGAL', sisaHari: null });
  });

  it('menghitung hari ini sebagai batas terakhir, bukan kedaluwarsa', () => {
    expect(statusSertifikat(HARI_INI, HARI_INI)).toEqual({ status: 'SEGERA', sisaHari: 0 });
  });
});

describe('bakukanHasil', () => {
  it('menyatukan belasan cara penulisan menjadi dua nilai', () => {
    for (const t of ['Baik', 'BAIK', 'sesuai', 'sesua', 'Siap Digunakan, Baik', 'diterima'])
      expect(bakukanHasil(t)).toBe('BAIK');
    expect(bakukanHasil('Good condition and ready to use')).toBe('BAIK');
  });

  it('mendahulukan penolakan agar "tidak sesuai" tidak terbaca baik', () => {
    expect(bakukanHasil('Tidak sesuai')).toBe('TIDAK SESUAI');
    expect(bakukanHasil('rusak, gagal uji')).toBe('TIDAK SESUAI');
  });

  it('membiarkan hasil kosong tetap kosong', () => {
    expect(bakukanHasil(null)).toBeNull();
    expect(bakukanHasil('   ')).toBeNull();
  });
});

describe('kunciPelaksana', () => {
  it('menyatukan penulisan yang sama', () => {
    expect(kunciPelaksana('PT Delta Instrumentasi')).toBe(kunciPelaksana('PT. DELTA INSTRUMENTASI'));
    expect(kunciPelaksana('PT.PLN (PERSERO) PUSAT SERTIFIKASI')).toBe('PLN PUSAT SERTIFIKASI');
  });
});

describe('periksaSertifikat', () => {
  it('menerima isian yang lengkap', () => {
    expect(periksaSertifikat(isi(), HARI_INI)).toEqual([]);
  });

  it('menolak nomor kosong', () => {
    expect(periksaSertifikat(isi({ nomor: '  ' }), HARI_INI)).toEqual([
      { field: 'nomor', message: 'Nomor sertifikat wajib diisi' },
    ]);
  });

  it('menolak tanggal kalibrasi di masa depan', () => {
    const salah = periksaSertifikat(isi({ tanggalKalibrasi: '2026-12-01' }), HARI_INI);
    expect(salah.map((x) => x.field)).toEqual(['tanggalKalibrasi']);
  });

  it('menolak tanggal kalibrasi ulang yang mendahului tanggal kalibrasi', () => {
    const salah = periksaSertifikat(
      isi({ tanggalKalibrasi: '2026-06-29', tanggalSaran: '2026-01-01' }),
      HARI_INI,
    );
    expect(salah.map((x) => x.field)).toEqual(['tanggalSaran']);
  });

  it('membolehkan tanggal kalibrasi ulang kosong', () => {
    expect(periksaSertifikat(isi({ tanggalSaran: null }), HARI_INI)).toEqual([]);
  });
});

describe('saranSetahun', () => {
  it('menambah satu tahun dari tanggal kalibrasi', () => {
    expect(saranSetahun('2026-06-29')).toBe('2027-06-29');
  });

  it('mengabaikan tanggal yang tidak sah', () => {
    expect(saranSetahun('kemarin')).toBeNull();
  });
});
