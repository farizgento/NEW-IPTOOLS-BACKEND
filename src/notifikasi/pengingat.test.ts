import { describe, expect, it } from 'vitest';
import {
  jenjangJatuhTempo,
  pengingatPengembalian,
  selisihHari,
  susunPesan,
  type JenjangPengingat,
} from './pengingat';

const hari = (n: number) => new Date(2026, 0, 1 + n, 9, 0, 0);
const kirim = hari(0);

function jatuhTempo(umurHari: number, sudah: JenjangPengingat[] = []) {
  return jenjangJatuhTempo(kirim, hari(umurHari), sudah)?.jenjang;
}

describe('selisihHari', () => {
  it('menghitung selisih hari penuh', () => {
    expect(selisihHari(hari(0), hari(3))).toBe(3);
  });

  it('belum genap sehari dihitung nol', () => {
    const pagi = new Date(2026, 0, 1, 9, 0);
    const malam = new Date(2026, 0, 1, 23, 0);
    expect(selisihHari(pagi, malam)).toBe(0);
  });
});

describe('jenjangJatuhTempo', () => {
  it('belum ada pengingat di hari yang sama', () => {
    expect(jatuhTempo(0)).toBeUndefined();
  });

  it('H1 jatuh tempo setelah sehari', () => {
    expect(jatuhTempo(1)).toBe('H1');
  });

  it('H3 jatuh tempo setelah tiga hari', () => {
    expect(jatuhTempo(3, ['H1'])).toBe('H3');
  });

  it('H7 jatuh tempo setelah sepekan', () => {
    expect(jatuhTempo(7, ['H1', 'H3'])).toBe('H7');
  });

  it('tidak mengulang jenjang yang sudah dikirim', () => {
    expect(jatuhTempo(2, ['H1'])).toBeUndefined();
  });

  it('berhenti setelah jenjang terakhir', () => {
    expect(jatuhTempo(30, ['H1', 'H3', 'H7'])).toBeUndefined();
  });

  it('hanya mengirim satu pesan meski beberapa jenjang terlewat', () => {
    // Pengiriman yang baru diperiksa setelah sepuluh hari: penerimanya cukup
    // mendapat satu pesan, bukan tiga sekaligus.
    expect(jatuhTempo(10)).toBe('H7');
  });

  it('memilih jenjang tertinggi yang belum dikirim', () => {
    expect(jatuhTempo(5, ['H1'])).toBe('H3');
  });

  it('tidak mengirim jenjang yang lebih rendah setelah yang tinggi terkirim', () => {
    // Pengiriman berumur seribu hari yang baru diperiksa: setelah menerima H7,
    // pemeriksaan berikutnya tidak boleh menyusulkan H3 lalu H1 — itu mundur,
    // bukan mendesak.
    expect(jatuhTempo(1000, ['H7'])).toBeUndefined();
    expect(jatuhTempo(1000, ['H3'])).toBe('H7');
    expect(jatuhTempo(1000, ['H1'])).toBe('H7');
  });

  it('berhenti sepenuhnya setelah jenjang tertinggi terkirim', () => {
    expect(jatuhTempo(9999, ['H7'])).toBeUndefined();
  });
});

describe('pengingatPengembalian', () => {
  const selesai = hari(10);

  it('mengingatkan sehari sebelum jatuh tempo', () => {
    expect(pengingatPengembalian(selesai, hari(9), [])?.jenjang).toBe('JATUH_TEMPO');
  });

  it('mengingatkan pada hari jatuh tempo', () => {
    expect(pengingatPengembalian(selesai, hari(10), [])?.jenjang).toBe('JATUH_TEMPO');
  });

  it('diam bila masih lama', () => {
    expect(pengingatPengembalian(selesai, hari(3), [])).toBeUndefined();
  });

  it('menandai terlambat setelah lewat', () => {
    const hasil = pengingatPengembalian(selesai, hari(13), ['JATUH_TEMPO']);
    expect(hasil?.jenjang).toBe('TERLAMBAT');
    expect(hasil?.perihal).toContain('3 hari');
  });

  it('tidak mengulang peringatan terlambat', () => {
    expect(pengingatPengembalian(selesai, hari(20), ['TERLAMBAT'])).toBeUndefined();
  });
});

describe('susunPesan', () => {
  const dasar = { namaPenerima: 'Budi', jumlahAlat: 3, nomorPeminjaman: 42, umurHari: 1 };

  it('menyebut "kemarin" untuk pengingat hari pertama', () => {
    const pesan = susunPesan({ ...dasar, jenjang: 'H1' });
    expect(pesan).toContain('dikirim kemarin');
    expect(pesan).toContain('#42');
  });

  it('menyebut umur pengiriman untuk jenjang berikutnya', () => {
    expect(susunPesan({ ...dasar, jenjang: 'H7', umurHari: 7 })).toContain('7 hari lalu');
  });

  it('pesan keterlambatan tidak menyinggung konfirmasi', () => {
    const pesan = susunPesan({ ...dasar, jenjang: 'TERLAMBAT' });
    expect(pesan).toContain('lewat tanggal pengembalian');
    expect(pesan).not.toContain('konfirmasi');
  });

  it('pesan jatuh tempo menyebut besok', () => {
    expect(susunPesan({ ...dasar, jenjang: 'JATUH_TEMPO' })).toContain('besok');
  });
});
