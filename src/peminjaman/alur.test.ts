import { describe, expect, it } from 'vitest';
import { masihBerjalan, rantaiUntuk, tentukanAlur } from './alur';

describe('tentukanAlur', () => {
  it('dalam unit bila seluruh alat milik unit peminjam', () => {
    expect(tentukanAlur({ unitPeminjamId: 7, unitAlatIds: [7, 7] })).toBe('DALAM_UNIT');
  });

  it('ambil di gudang bila dalam unit dan diminta demikian', () => {
    expect(tentukanAlur({ unitPeminjamId: 7, unitAlatIds: [7], ambilDiGudang: true })).toBe(
      'DALAM_UNIT_GUDANG',
    );
  });

  it('antar unit bila satu saja alat berasal dari unit lain', () => {
    // Tingkat approval mengikuti bagian yang paling menuntut.
    expect(tentukanAlur({ unitPeminjamId: 7, unitAlatIds: [7, 7, 9] })).toBe('ANTAR_UNIT');
  });

  it('eksternal mengalahkan pemeriksaan unit', () => {
    expect(tentukanAlur({ unitPeminjamId: 7, unitAlatIds: [7], eksternal: true })).toBe(
      'EKSTERNAL',
    );
  });

  it('ambil di gudang diabaikan bila alatnya antar unit', () => {
    expect(
      tentukanAlur({ unitPeminjamId: 7, unitAlatIds: [9], ambilDiGudang: true }),
    ).toBe('ANTAR_UNIT');
  });

  describe('ketika unit belum diketahui', () => {
    // 294 pengguna belum punya unit selama akses kepegawaian belum tersedia
    // (PRD 6.2.1). Menebak "dalam unit" berarti melewatkan approval Manajer,
    // jadi sisi amannya adalah menuntut approval lebih banyak.
    it('memilih antar unit bila unit peminjam kosong', () => {
      expect(tentukanAlur({ unitPeminjamId: null, unitAlatIds: [7] })).toBe('ANTAR_UNIT');
    });

    it('memilih antar unit bila ada alat tanpa unit', () => {
      expect(tentukanAlur({ unitPeminjamId: 7, unitAlatIds: [7, null] })).toBe('ANTAR_UNIT');
    });

    it('tetap eksternal meski unit kosong', () => {
      expect(tentukanAlur({ unitPeminjamId: null, unitAlatIds: [], eksternal: true })).toBe(
        'EKSTERNAL',
      );
    });
  });
});

describe('rantaiUntuk', () => {
  it('dalam unit cukup pengelola — sesuai SK Lampiran 2 alur 1', () => {
    expect(rantaiUntuk('DALAM_UNIT')).toEqual(['PENGELOLA']);
    expect(rantaiUntuk('DALAM_UNIT_GUDANG')).toEqual(['PENGELOLA']);
  });

  it('antar unit menambah manajer — SK Lampiran 2 alur 2', () => {
    expect(rantaiUntuk('ANTAR_UNIT')).toEqual(['PENGELOLA', 'MANAJER']);
  });

  it('eksternal menambah GM — SK Lampiran 3', () => {
    expect(rantaiUntuk('EKSTERNAL')).toEqual(['PENGELOLA', 'MANAJER', 'GM']);
  });
});

describe('masihBerjalan', () => {
  it('pengajuan selesai tidak lagi memakai alatnya', () => {
    expect(masihBerjalan('FINISH')).toBe(false);
    expect(masihBerjalan('PARTIAL FINISH')).toBe(false);
    expect(masihBerjalan('REJECT')).toBe(false);
  });

  it('pengajuan yang belum tuntas masih memakai alatnya', () => {
    expect(masihBerjalan('BOOKED')).toBe(true);
    expect(masihBerjalan('SENT')).toBe(true);
    expect(masihBerjalan('PARTIAL RECEIVED')).toBe(true);
  });

  it('tidak peduli besar kecil huruf', () => {
    expect(masihBerjalan('finish')).toBe(false);
  });
});
