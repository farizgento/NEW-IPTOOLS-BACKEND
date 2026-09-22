import { describe, expect, it } from 'vitest';
import {
  bolehMemutuskan,
  periksaAlasan,
  statusSetelahKeputusan,
  tahapBerjalan,
  type BarisApproval,
} from './keputusan';

const rantaiAntarUnit: BarisApproval[] = [
  { urutan: 1, tahap: 'PENGELOLA', keputusan: 'MENUNGGU' },
  { urutan: 2, tahap: 'MANAJER', keputusan: 'MENUNGGU' },
];

const rantaiDalamUnit: BarisApproval[] = [
  { urutan: 1, tahap: 'PENGELOLA', keputusan: 'MENUNGGU' },
];

const rantaiEksternal: BarisApproval[] = [
  { urutan: 1, tahap: 'PENGELOLA', keputusan: 'SETUJU' },
  { urutan: 2, tahap: 'MANAJER', keputusan: 'MENUNGGU' },
  { urutan: 3, tahap: 'GM', keputusan: 'MENUNGGU' },
];

describe('tahapBerjalan', () => {
  it('memilih tahap paling awal yang belum diputuskan', () => {
    expect(tahapBerjalan(rantaiAntarUnit)?.tahap).toBe('PENGELOLA');
  });

  it('berpindah ke tahap berikutnya setelah yang awal diputuskan', () => {
    expect(tahapBerjalan(rantaiEksternal)?.tahap).toBe('MANAJER');
  });

  it('tidak menghasilkan apa pun bila seluruh tahap selesai', () => {
    expect(tahapBerjalan([{ urutan: 1, tahap: 'PENGELOLA', keputusan: 'SETUJU' }])).toBeUndefined();
  });

  it('tidak terpengaruh urutan baris yang tidak terurut', () => {
    const acak: BarisApproval[] = [
      { urutan: 2, tahap: 'MANAJER', keputusan: 'MENUNGGU' },
      { urutan: 1, tahap: 'PENGELOLA', keputusan: 'MENUNGGU' },
    ];
    expect(tahapBerjalan(acak)?.tahap).toBe('PENGELOLA');
  });
});

describe('bolehMemutuskan', () => {
  it('mengizinkan pengelola pada tahap pertama', () => {
    expect(bolehMemutuskan(rantaiAntarUnit, ['PENGELOLA'], 'BOOKED').boleh).toBe(true);
  });

  it('menolak manajer yang mendahului pengelola', () => {
    // SK menempatkan review SP/SPS lebih dulu; rantai berjalan berurutan.
    const hasil = bolehMemutuskan(rantaiAntarUnit, ['MANAJER'], 'BOOKED');
    expect(hasil.boleh).toBe(false);
    if (!hasil.boleh) expect(hasil.alasan).toMatch(/PENGELOLA/);
  });

  it('mengizinkan manajer setelah giliran pengelola lewat', () => {
    expect(bolehMemutuskan(rantaiEksternal, ['MANAJER'], 'WAPPR MGR').boleh).toBe(true);
  });

  it('menolak peminjam biasa', () => {
    expect(bolehMemutuskan(rantaiAntarUnit, ['PEMINJAM'], 'BOOKED').boleh).toBe(false);
  });

  it('menolak admin super sekalipun', () => {
    // Mengelola master data bukan berarti berhak menyetujui peminjaman.
    expect(bolehMemutuskan(rantaiAntarUnit, ['ADMIN_SUPER'], 'BOOKED').boleh).toBe(false);
  });

  it('menolak keputusan ganda', () => {
    const selesai: BarisApproval[] = [{ urutan: 1, tahap: 'PENGELOLA', keputusan: 'SETUJU' }];
    const hasil = bolehMemutuskan(selesai, ['PENGELOLA'], 'APPROVED');
    expect(hasil.boleh).toBe(false);
    if (!hasil.boleh) expect(hasil.alasan).toMatch(/seluruh tahap/);
  });

  it('menolak keputusan atas pengajuan yang sudah ditolak', () => {
    const hasil = bolehMemutuskan(rantaiAntarUnit, ['PENGELOLA'], 'REJECT');
    expect(hasil.boleh).toBe(false);
    if (!hasil.boleh) expect(hasil.alasan).toMatch(/ditolak/);
  });
});

describe('statusSetelahKeputusan', () => {
  it('dalam unit: pengelola setuju langsung APPROVED', () => {
    expect(statusSetelahKeputusan(rantaiDalamUnit, 'PENGELOLA', 'SETUJU')).toBe('APPROVED');
  });

  it('antar unit: pengelola setuju menjadi WAPPR MGR', () => {
    expect(statusSetelahKeputusan(rantaiAntarUnit, 'PENGELOLA', 'SETUJU')).toBe('WAPPR MGR');
  });

  it('antar unit: manajer setuju menjadi APPROVED', () => {
    expect(statusSetelahKeputusan(rantaiAntarUnit, 'MANAJER', 'SETUJU')).toBe('APPROVED');
  });

  it('eksternal: manajer setuju menjadi WAPPR GM', () => {
    expect(statusSetelahKeputusan(rantaiEksternal, 'MANAJER', 'SETUJU')).toBe('WAPPR GM');
  });

  it('eksternal: GM setuju menjadi APPROVED', () => {
    expect(statusSetelahKeputusan(rantaiEksternal, 'GM', 'SETUJU')).toBe('APPROVED');
  });

  it('penolakan pada tahap mana pun menjadi REJECT', () => {
    expect(statusSetelahKeputusan(rantaiAntarUnit, 'PENGELOLA', 'TOLAK')).toBe('REJECT');
    expect(statusSetelahKeputusan(rantaiEksternal, 'GM', 'TOLAK')).toBe('REJECT');
  });
});

describe('periksaAlasan', () => {
  it('tidak menuntut alasan saat menyetujui', () => {
    expect(periksaAlasan('SETUJU')).toBeNull();
  });

  it('menuntut alasan saat menolak', () => {
    // 93% penolakan di data lama tanpa alasan spesifik.
    expect(periksaAlasan('TOLAK')).toMatch(/wajib/);
    expect(periksaAlasan('TOLAK', '   ')).toMatch(/wajib/);
  });

  it('menolak alasan yang terlalu singkat', () => {
    expect(periksaAlasan('TOLAK', 'ga')).toMatch(/singkat/);
  });

  it('menerima alasan yang bermakna', () => {
    expect(periksaAlasan('TOLAK', 'Nomor WO belum diisi')).toBeNull();
  });
});
