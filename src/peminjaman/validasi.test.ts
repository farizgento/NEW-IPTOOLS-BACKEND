import { describe, expect, it } from 'vitest';
import { ringkasDugaanKembar, validasiPengajuan } from './validasi';

const sah = {
  pekerjaan: 'Overhaul turbin',
  nomorWo: 'WO-12345',
  tanggalMulai: '2026-09-01',
  tanggalSelesai: '2026-09-10',
  alatIds: [1, 2],
};

function pesan(hasil: ReturnType<typeof validasiPengajuan>, field: string) {
  return hasil.find((p) => p.field === field)?.message;
}

describe('validasiPengajuan', () => {
  it('menerima pengajuan yang lengkap', () => {
    expect(validasiPengajuan(sah)).toEqual([]);
  });

  it('menolak tanpa nomor WO', () => {
    // Penyebab penolakan paling sering di data produksi.
    expect(pesan(validasiPengajuan({ ...sah, nomorWo: '' }), 'nomorWo')).toMatch(/Nomor WO/);
    expect(pesan(validasiPengajuan({ ...sah, nomorWo: '   ' }), 'nomorWo')).toMatch(/Nomor WO/);
  });

  it('menolak tanpa pekerjaan', () => {
    expect(pesan(validasiPengajuan({ ...sah, pekerjaan: '' }), 'pekerjaan')).toBeTruthy();
  });

  it('menolak keranjang kosong', () => {
    expect(pesan(validasiPengajuan({ ...sah, alatIds: [] }), 'alatIds')).toMatch(/satu alat/);
  });

  it('menolak alat yang terpilih dua kali', () => {
    expect(pesan(validasiPengajuan({ ...sah, alatIds: [3, 3] }), 'alatIds')).toMatch(/sekali/);
  });

  it('menolak tanggal selesai yang mendahului tanggal mulai', () => {
    const hasil = validasiPengajuan({ ...sah, tanggalSelesai: '2026-08-31' });
    expect(pesan(hasil, 'tanggalSelesai')).toMatch(/mendahului/);
  });

  it('menerima tanggal mulai dan selesai yang sama', () => {
    expect(validasiPengajuan({ ...sah, tanggalSelesai: sah.tanggalMulai })).toEqual([]);
  });

  it('menolak format tanggal yang bukan YYYY-MM-DD', () => {
    expect(pesan(validasiPengajuan({ ...sah, tanggalMulai: '01-09-2026' }), 'tanggalMulai'))
      .toBeTruthy();
  });

  it('mengumpulkan seluruh pelanggaran sekaligus', () => {
    // Pengguna melihat semua yang kurang sekali jalan, bukan satu per satu.
    const hasil = validasiPengajuan({
      pekerjaan: '',
      nomorWo: '',
      tanggalMulai: '',
      tanggalSelesai: '',
      alatIds: [],
    });
    expect(hasil.length).toBeGreaterThanOrEqual(5);
  });
});

describe('ringkasDugaanKembar', () => {
  it('tidak berpesan bila tidak ada dugaan', () => {
    expect(ringkasDugaanKembar([])).toBeNull();
  });

  it('menyebut alat dan nomor pengajuan yang bentrok', () => {
    const pesanKembar = ringkasDugaanKembar([
      { alatId: 1, namaAlat: 'Vibration Meter', peminjamanId: 42, status: 'SENT' },
    ]);
    expect(pesanKembar).toContain('Vibration Meter');
    expect(pesanKembar).toContain('#42');
    expect(pesanKembar).toContain('SENT');
  });
});
