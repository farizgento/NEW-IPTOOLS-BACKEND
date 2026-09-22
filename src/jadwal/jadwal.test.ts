import { describe, expect, it } from 'vitest';
import { bertumpuk, ringkasJadwal, statusJadwal, tandaiTabrakan, type Jadwal } from './jadwal';

const HARI_INI = '2026-09-21';

const jadwal = (ubah: Partial<Jadwal> = {}): Jadwal => ({
  peminjamanAlatId: 1,
  peminjamanId: 10,
  alatId: 100,
  mulai: '2026-09-15',
  selesai: '2026-09-30',
  statusAlat: 'DITERIMA',
  tanggalKembali: null,
  ...ubah,
});

describe('bertumpuk', () => {
  it('menghitung hari batas sebagai tumpang', () => {
    expect(
      bertumpuk({ mulai: '2026-09-01', selesai: '2026-09-10' }, { mulai: '2026-09-10', selesai: '2026-09-20' }),
    ).toBe(true);
  });

  it('memisahkan periode yang berurutan tanpa tumpang', () => {
    expect(
      bertumpuk({ mulai: '2026-09-01', selesai: '2026-09-09' }, { mulai: '2026-09-10', selesai: '2026-09-20' }),
    ).toBe(false);
  });
});

describe('statusJadwal', () => {
  it('menandai alat yang sedang dipakai', () => {
    expect(statusJadwal(jadwal(), HARI_INI)).toBe('DIPAKAI');
  });

  it('menandai lewat jadwal ketika alat belum kembali melewati tanggal selesai', () => {
    expect(statusJadwal(jadwal({ selesai: '2026-09-10' }), HARI_INI)).toBe('LEWAT');
  });

  it('menandai selesai begitu alat dikembalikan', () => {
    expect(statusJadwal(jadwal({ selesai: '2026-09-10', tanggalKembali: '2026-09-09' }), HARI_INI)).toBe(
      'SELESAI',
    );
  });

  it('menandai pengajuan yang belum diserahkan sebagai dijadwalkan', () => {
    expect(statusJadwal(jadwal({ statusAlat: 'DIAJUKAN', mulai: '2026-10-01', selesai: '2026-10-10' }), HARI_INI)).toBe(
      'DIJADWALKAN',
    );
  });

  it('tidak menandai lewat untuk pengajuan lama yang tidak pernah diserahkan', () => {
    expect(statusJadwal(jadwal({ statusAlat: 'DIAJUKAN', mulai: '2025-01-01', selesai: '2025-01-10' }), HARI_INI)).toBe(
      'SELESAI',
    );
  });
});

describe('tandaiTabrakan', () => {
  it('menandai dua jadwal yang bertumpuk pada alat yang sama', () => {
    const hasil = tandaiTabrakan(
      [
        jadwal({ peminjamanAlatId: 1, mulai: '2026-09-20', selesai: '2026-09-27' }),
        jadwal({ peminjamanAlatId: 2, mulai: '2026-09-23', selesai: '2026-10-02' }),
      ],
      HARI_INI,
    );
    expect(hasil[0]!.tabrakDengan).toEqual([2]);
    expect(hasil[1]!.tabrakDengan).toEqual([1]);
  });

  it('menaruh jadwal yang bertumpuk pada jalur berbeda', () => {
    const hasil = tandaiTabrakan(
      [
        jadwal({ peminjamanAlatId: 1, mulai: '2026-09-20', selesai: '2026-09-27' }),
        jadwal({ peminjamanAlatId: 2, mulai: '2026-09-23', selesai: '2026-10-02' }),
      ],
      HARI_INI,
    );
    expect(hasil.map((x) => x.jalur)).toEqual([0, 1]);
  });

  it('memakai jalur yang sama untuk jadwal yang tidak bertumpuk', () => {
    const hasil = tandaiTabrakan(
      [
        jadwal({ peminjamanAlatId: 1, mulai: '2026-09-01', selesai: '2026-09-05' }),
        jadwal({ peminjamanAlatId: 2, mulai: '2026-09-10', selesai: '2026-09-15' }),
      ],
      HARI_INI,
    );
    expect(hasil.map((x) => x.jalur)).toEqual([0, 0]);
    expect(hasil.every((x) => x.tabrakDengan.length === 0)).toBe(true);
  });
});

describe('ringkasJadwal', () => {
  it('menghitung batang per status dan jumlah alat yang bertabrakan', () => {
    const alatA = {
      jadwal: tandaiTabrakan(
        [
          jadwal({ peminjamanAlatId: 1, mulai: '2026-09-20', selesai: '2026-09-27' }),
          jadwal({ peminjamanAlatId: 2, mulai: '2026-09-23', selesai: '2026-10-02' }),
        ],
        HARI_INI,
      ),
    };
    const alatB = {
      jadwal: tandaiTabrakan(
        [jadwal({ peminjamanAlatId: 3, alatId: 200, statusAlat: 'DIAJUKAN', mulai: '2026-10-05', selesai: '2026-10-09' })],
        HARI_INI,
      ),
    };
    expect(ringkasJadwal([alatA, alatB])).toEqual({
      dipakai: 2,
      dijadwalkan: 1,
      lewat: 0,
      selesai: 0,
      alatBertabrakan: 1,
    });
  });
});
