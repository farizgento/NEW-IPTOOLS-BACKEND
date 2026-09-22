import { describe, expect, it } from 'vitest';
import { AMBANG_MIRIP, miripProyek, normalNama, periksaProyek, type IsiProyek } from './proyek';

const isi = (ubah: Partial<IsiProyek> = {}): IsiProyek => ({
  nama: 'Overhaul PLTU Suralaya Unit 5',
  tanggalMulai: '2026-10-01',
  tanggalSelesai: '2026-11-30',
  site: 'PLTU Suralaya',
  tipeOhId: null,
  ...ubah,
});

describe('periksaProyek', () => {
  it('menerima isian lengkap', () => {
    expect(periksaProyek(isi())).toEqual([]);
  });

  it('menolak nama kosong', () => {
    expect(periksaProyek(isi({ nama: '   ' })).map((x) => x.field)).toEqual(['nama']);
  });

  it('menolak tanggal selesai yang mendahului tanggal mulai', () => {
    const salah = periksaProyek(isi({ tanggalMulai: '2026-11-01', tanggalSelesai: '2026-10-01' }));
    expect(salah.map((x) => x.field)).toEqual(['tanggalSelesai']);
  });

  it('membolehkan proyek tanpa periode', () => {
    expect(periksaProyek(isi({ tanggalMulai: null, tanggalSelesai: null }))).toEqual([]);
  });
});

describe('normalNama', () => {
  it('menyamakan beda spasi dan huruf besar-kecil', () => {
    expect(normalNama('  Overhaul   PLTU  ')).toBe(normalNama('overhaul pltu'));
  });
});

describe('miripProyek', () => {
  it('menyatakan sama untuk penulisan yang hanya beda spasi', () => {
    expect(miripProyek('OH SI PLTU Lontar Unit 1', 'OH  SI PLTU LONTAR UNIT 1')).toBe(1);
  });

  it('tidak menyarankan pekerjaan dengan nomor unit berbeda', () => {
    expect(miripProyek('Overhaul PLTU Suralaya Unit 5', 'Overhaul PLTU Suralaya Unit 7')).toBe(0);
  });

  it('memberi nilai di bawah ambang untuk pekerjaan yang hanya mirip sebagian', () => {
    const nilai = miripProyek('Assessment Boiler PLTU Jeranjang', 'Assessment Turbin PLTU Adipala');
    expect(nilai).toBeLessThan(AMBANG_MIRIP);
  });

  it('memberi nilai di atas ambang untuk nama yang sama dengan satu kata tambahan', () => {
    const nilai = miripProyek(
      'Major Inspection PLTGU Priok Blok 3',
      'Major Inspection PLTGU Priok Blok 3 Lanjutan',
    );
    expect(nilai).toBeGreaterThanOrEqual(AMBANG_MIRIP);
  });
});
