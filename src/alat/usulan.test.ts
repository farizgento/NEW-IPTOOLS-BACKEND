import { describe, expect, it } from 'vitest';
import {
  bakukanIsiLama,
  bolehMengusulkan,
  periksaKeputusan,
  saringIsi,
  statusRiwayat,
  susunPerubahan,
  validasiUsulan,
} from './usulan';

describe('saringIsi', () => {
  it('membawa bidang yang dikenal', () => {
    expect(saringIsi({ nama: 'Kunci Torsi', nilaiKontrak: 5_000_000 })).toEqual({
      nama: 'Kunci Torsi',
      nilaiKontrak: 5_000_000,
    });
  });

  it('membuang bidang yang tidak dikenal', () => {
    // Pagar keamanan: nama kolom tidak dapat diikat sebagai parameter SQL,
    // jadi bidang di luar daftar tidak boleh sampai ke pernyataan UPDATE.
    const hasil = saringIsi({ nama: 'X', 'id = 1; DROP TABLE alat; --': 'y', dihapus_pada: 'z' });
    expect(Object.keys(hasil)).toEqual(['nama']);
  });

  it('membuang nilai yang bukan teks atau angka', () => {
    expect(saringIsi({ nama: { jahat: true }, unitId: [1, 2] })).toEqual({});
  });

  it('mempertahankan null sebagai niat mengosongkan', () => {
    expect(saringIsi({ kodeMaximo: null })).toEqual({ kodeMaximo: null });
  });
});

describe('validasiUsulan', () => {
  it('menolak usulan ubah tanpa perubahan', () => {
    expect(validasiUsulan('UBAH', {})).toHaveLength(1);
  });

  it('usulan hapus tidak butuh isi', () => {
    expect(validasiUsulan('HAPUS', {})).toEqual([]);
  });

  it('menolak nama yang dikosongkan', () => {
    expect(validasiUsulan('UBAH', { nama: '   ' })[0]?.field).toBe('nama');
  });

  it('menolak angka negatif', () => {
    expect(validasiUsulan('UBAH', { nilaiKontrak: -1 })[0]?.field).toBe('nilaiKontrak');
  });

  it('menolak tahun perolehan yang tidak masuk akal', () => {
    expect(validasiUsulan('UBAH', { tahunPerolehan: 1800 })[0]?.field).toBe('tahunPerolehan');
  });

  it('menerima perubahan yang wajar', () => {
    expect(validasiUsulan('UBAH', { nama: 'Megger 5kV', tahunPerolehan: 2019 })).toEqual([]);
  });
});

describe('bolehMengusulkan', () => {
  it('mengizinkan bila tidak ada usulan menunggu', () => {
    expect(bolehMengusulkan(0)).toBeNull();
  });

  it('menolak usulan kedua selagi yang pertama menunggu', () => {
    expect(bolehMengusulkan(1)?.message).toMatch(/menunggu/);
  });
});

describe('periksaKeputusan', () => {
  const dasar = { statusSaatIni: 'WAITING APPROVAL', keputusan: 'SETUJU' as const, adalahPemutusSah: true };

  it('mengizinkan pemutus sah menyetujui usulan yang menunggu', () => {
    expect(periksaKeputusan(dasar).boleh).toBe(true);
  });

  it('menolak pemutus yang bukan admin super', () => {
    // Sistem lama tidak memeriksa ini sama sekali.
    expect(periksaKeputusan({ ...dasar, adalahPemutusSah: false }).boleh).toBe(false);
  });

  it('menolak keputusan ganda', () => {
    const hasil = periksaKeputusan({ ...dasar, statusSaatIni: 'APPROVE' });
    expect(hasil.boleh).toBe(false);
    expect(hasil.alasan).toMatch(/sudah diputuskan/);
  });

  it('menuntut alasan saat menolak', () => {
    expect(periksaKeputusan({ ...dasar, keputusan: 'TOLAK' }).boleh).toBe(false);
    expect(periksaKeputusan({ ...dasar, keputusan: 'TOLAK', alasan: 'Kode barcode keliru' }).boleh).toBe(true);
  });
});

describe('statusRiwayat', () => {
  it('mencatat persetujuan sebagai APPROVE', () => {
    expect(statusRiwayat('SETUJU')).toBe('APPROVE');
  });

  it('mencatat penolakan sebagai REJECT, bukan APPROVE', () => {
    // Procedure lama menulis 'APPROVE' untuk semua keputusan: 35 penolakan
    // tercatat sebagai persetujuan di data produksi.
    expect(statusRiwayat('TOLAK')).toBe('REJECT');
  });
});

describe('susunPerubahan', () => {
  it('memetakan bidang ke kolom dan mengikat nilainya', () => {
    const { set, ikatan } = susunPerubahan({ nama: 'Baru', unitId: 3 });
    expect(set).toBe('nama = :nama, unit_id = :unitId');
    expect(ikatan).toEqual({ nama: 'Baru', unitId: 3 });
  });

  it('mengubah teks kosong menjadi null', () => {
    expect(susunPerubahan({ kodeMaximo: '' }).ikatan).toEqual({ kodeMaximo: null });
  });

  it('tidak pernah menyisipkan nilai ke dalam teks SQL', () => {
    const { set } = susunPerubahan({ nama: "'; DROP TABLE alat; --" });
    expect(set).toBe('nama = :nama');
    expect(set).not.toContain('DROP');
  });
});

describe('bakukanIsiLama', () => {
  const peta: Record<string, number> = { 'jenisId:lifting tools': 3, 'kondisiId:rusak': 7, 'lokasiId:msu ks tubun': 11 };
  const cari = (b: string, n: string) => peta[`${b}:${n.trim().replace(/\s+/g, ' ').toLowerCase()}`];

  it('memetakan namaAlat dan nama referensi ke kolom baru', () => {
    const h = bakukanIsiLama(
      { namaAlat: ' BASE MON ', jenis: 'Lifting  Tools', kondisi: 'Rusak', lokasi: 'MSU KS Tubun', tahunPerolehan: 2018 },
      cari,
    );
    expect(h.isi).toEqual({ nama: 'BASE MON', jenisId: 3, kondisiId: 7, lokasiId: 11, tahunPerolehan: 2018 });
    expect(h.takTerpetakan).toEqual([]);
  });

  it('melaporkan nama yang tidak dikenal alih-alih membuangnya diam-diam', () => {
    const h = bakukanIsiLama({ kondisi: 'Hilang' }, cari);
    expect(h.isi).toEqual({});
    expect(h.takTerpetakan).toEqual(['kondisi "Hilang"']);
  });

  it('tidak menimpa kunci baru yang sudah ada', () => {
    const h = bakukanIsiLama({ nama: 'Baru', namaAlat: 'Lama', kondisiId: 1, kondisi: 'Rusak' }, cari);
    expect(h.isi).toEqual({ nama: 'Baru', kondisiId: 1 });
  });

  it('isi baru tetap utuh', () => {
    expect(bakukanIsiLama({ nama: 'X', unitId: 2 }, cari)).toEqual({ isi: { nama: 'X', unitId: 2 }, takTerpetakan: [] });
  });
});
