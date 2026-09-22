import { describe, expect, it } from 'vitest';
import {
  bentukPertanyaan,
  rekapIpa,
  sesiLengkap,
  validasiJawaban,
  type Pertanyaan,
} from './kuesioner';

const PERTANYAAN: Pertanyaan[] = [
  { id: 1, kategori: 'Availability', pertanyaan: 'Alat tersedia saat dibutuhkan' },
  { id: 2, kategori: 'Reliability', pertanyaan: 'Alat berfungsi baik' },
  { id: 3, kategori: 'Kritik', pertanyaan: 'Kritik' },
  { id: 4, kategori: 'Saran', pertanyaan: 'Saran' },
];

const lengkap = [
  { pertanyaanId: 1, kepentingan: 5, kinerja: 4 },
  { pertanyaanId: 2, kepentingan: 4, kinerja: 4 },
  { pertanyaanId: 3, teks: 'Proses peminjaman terlalu lama' },
  { pertanyaanId: 4, teks: 'Perkuat jaringan area' },
];

describe('bentukPertanyaan', () => {
  it('kritik dan saran berupa teks', () => {
    expect(bentukPertanyaan(PERTANYAAN[2]!)).toBe('TEKS');
    expect(bentukPertanyaan({ id: 9, kategori: ' saran ', pertanyaan: 'x' })).toBe('TEKS');
  });

  it('kategori lain berupa skala', () => {
    expect(bentukPertanyaan(PERTANYAAN[0]!)).toBe('SKALA');
  });
});

describe('validasiJawaban', () => {
  it('menerima jawaban lengkap yang sah', () => {
    expect(validasiJawaban(PERTANYAAN, lengkap)).toEqual([]);
  });

  it('menolak skala di luar 1–5', () => {
    const hasil = validasiJawaban(PERTANYAAN, [{ pertanyaanId: 1, kepentingan: 6, kinerja: 0 }]);
    expect(hasil.map((h) => h.field)).toEqual(['jawaban.1.kepentingan', 'jawaban.1.kinerja']);
  });

  it('menolak skala pecahan', () => {
    expect(validasiJawaban(PERTANYAAN, [{ pertanyaanId: 1, kepentingan: 3.5, kinerja: 3 }])).toHaveLength(1);
  });

  it('menolak kritik yang kosong', () => {
    expect(validasiJawaban(PERTANYAAN, [{ pertanyaanId: 3, teks: '  ' }])).toHaveLength(1);
  });

  it('menolak satu pertanyaan dijawab dua kali', () => {
    // Celah procedure lama: jawaban ganda dihitung sebagai dua jawaban.
    const hasil = validasiJawaban(PERTANYAAN, [
      { pertanyaanId: 1, kepentingan: 5, kinerja: 5 },
      { pertanyaanId: 1, kepentingan: 4, kinerja: 4 },
    ]);
    expect(hasil[0]?.message).toMatch(/lebih dari sekali/);
  });

  it('menolak pertanyaan yang tidak dikenali', () => {
    expect(validasiJawaban(PERTANYAAN, [{ pertanyaanId: 99, kepentingan: 5, kinerja: 5 }])).toHaveLength(1);
  });
});

describe('sesiLengkap', () => {
  it('lengkap bila setiap pertanyaan terjawab', () => {
    expect(sesiLengkap([1, 2, 3, 4], [1, 2, 3, 4])).toBe(true);
  });

  it('tidak lengkap bila ada yang terlewat, meski jumlahnya sama', () => {
    // Empat jawaban, tetapi pertanyaan 1 dijawab dua kali dan pertanyaan 4
    // terlewat. Procedure lama menganggap ini lengkap.
    expect(sesiLengkap([1, 2, 3, 4], [1, 1, 2, 3])).toBe(false);
  });

  it('tidak lengkap bila bank pertanyaan kosong', () => {
    expect(sesiLengkap([], [])).toBe(false);
  });
});

describe('rekapIpa', () => {
  const baris = [
    // Pertanyaan 1: sangat penting, kinerja rendah → perlu diperbaiki
    { pertanyaanId: 1, kepentingan: 5, kinerja: 2 },
    { pertanyaanId: 1, kepentingan: 5, kinerja: 3 },
    // Pertanyaan 2: penting dan memuaskan
    { pertanyaanId: 2, kepentingan: 5, kinerja: 5 },
    // Pertanyaan 3: kurang penting, kinerja tinggi
    { pertanyaanId: 3, kepentingan: 2, kinerja: 5 },
  ];

  it('menghitung rata-rata dan selisih', () => {
    const p1 = rekapIpa(baris).find((r) => r.pertanyaanId === 1)!;
    expect(p1.rataKepentingan).toBe(5);
    expect(p1.rataKinerja).toBe(2.5);
    expect(p1.selisih).toBe(2.5);
    expect(p1.jumlahResponden).toBe(2);
  });

  it('menempatkan yang penting tetapi kurang memuaskan di prioritas perbaikan', () => {
    const hasil = rekapIpa(baris);
    expect(hasil.find((r) => r.pertanyaanId === 1)?.prioritas).toBe('PERBAIKI');
    expect(hasil.find((r) => r.pertanyaanId === 2)?.prioritas).toBe('PERTAHANKAN');
    expect(hasil.find((r) => r.pertanyaanId === 3)?.prioritas).toBe('BERLEBIH');
  });

  it('mengurutkan dari selisih terbesar', () => {
    expect(rekapIpa(baris)[0]?.pertanyaanId).toBe(1);
  });

  it('aman untuk data kosong', () => {
    expect(rekapIpa([])).toEqual([]);
  });
});
