import { describe, expect, it } from 'vitest';
import {
  akhiranCocok,
  bersihkanNamaAsli,
  isiCocok,
  lokasiRelatif,
  namaSimpan,
  periksaTujuan,
  UKURAN_MAKS_BAWAAN,
  validasiBerkas,
} from './berkas';

const sah = { namaAsli: 'foto.jpg', tipeMedia: 'image/jpeg', ukuran: 1024 };

describe('validasiBerkas', () => {
  it('menerima gambar dan PDF dalam batas ukuran', () => {
    expect(validasiBerkas(sah, UKURAN_MAKS_BAWAAN)).toEqual([]);
    expect(
      validasiBerkas({ namaAsli: 'a.pdf', tipeMedia: 'application/pdf', ukuran: 500 }, UKURAN_MAKS_BAWAAN),
    ).toEqual([]);
  });

  it('menolak berkas kosong', () => {
    expect(validasiBerkas({ ...sah, ukuran: 0 }, UKURAN_MAKS_BAWAAN)).not.toEqual([]);
  });

  it('menolak berkas yang melebihi batas', () => {
    const hasil = validasiBerkas({ ...sah, ukuran: UKURAN_MAKS_BAWAAN + 1 }, UKURAN_MAKS_BAWAAN);
    expect(hasil[0]?.message).toMatch(/melebihi/);
  });

  it('menolak tipe yang tidak diterima', () => {
    // Berkas yang dapat dieksekusi tidak boleh masuk penyimpanan.
    const hasil = validasiBerkas(
      { namaAsli: 'jahat.exe', tipeMedia: 'application/x-msdownload', ukuran: 10 },
      UKURAN_MAKS_BAWAAN,
    );
    expect(hasil[0]?.message).toMatch(/tidak diterima/);
  });

  it('menolak html yang dapat dijalankan peramban', () => {
    const hasil = validasiBerkas(
      { namaAsli: 'x.html', tipeMedia: 'text/html', ukuran: 10 },
      UKURAN_MAKS_BAWAAN,
    );
    expect(hasil).not.toEqual([]);
  });
});

describe('namaSimpan', () => {
  it('memakai akhiran dari tipe media, bukan dari nama pengunggah', () => {
    expect(namaSimpan('image/png')).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(namaSimpan('application/pdf')).toMatch(/\.pdf$/);
  });

  it('tidak pernah menghasilkan nama yang sama', () => {
    const kumpulan = new Set(Array.from({ length: 200 }, () => namaSimpan('image/jpeg')));
    expect(kumpulan.size).toBe(200);
  });
});

describe('bersihkanNamaAsli', () => {
  it('membuang bagian jalur pada nama unggahan', () => {
    // Nama semacam ini yang membawa berkas keluar dari direktori penyimpanan.
    expect(bersihkanNamaAsli('../../etc/passwd')).toBe('passwd');
    expect(bersihkanNamaAsli('..\\windows\\system32\\cmd.exe')).toBe('cmd.exe');
  });

  it('membuang karakter yang bermasalah di sistem berkas', () => {
    expect(bersihkanNamaAsli('lap:oran"uji?.pdf')).toBe('lap_oran_uji_.pdf');
  });

  it('memberi nama cadangan bila hasilnya kosong', () => {
    expect(bersihkanNamaAsli('///')).toBe('berkas');
  });

  it('memotong nama yang terlalu panjang', () => {
    expect(bersihkanNamaAsli('a'.repeat(400)).length).toBe(255);
  });
});

describe('akhiranCocok', () => {
  it('menerima jpg dan jpeg untuk image/jpeg', () => {
    expect(akhiranCocok('foto.jpg', 'image/jpeg')).toBe(true);
    expect(akhiranCocok('foto.jpeg', 'image/jpeg')).toBe(true);
  });

  it('menolak akhiran yang tidak sesuai tipenya', () => {
    // Berkas exe yang menyamar sebagai gambar.
    expect(akhiranCocok('gambar.exe', 'image/png')).toBe(false);
  });

  it('menerima nama tanpa akhiran', () => {
    expect(akhiranCocok('berkas', 'application/pdf')).toBe(true);
  });
});

describe('lokasiRelatif', () => {
  it('memisahkan penyimpanan per entitas dan nomornya', () => {
    expect(lokasiRelatif('KERUSAKAN', 42, 'abc.jpg')).toBe('kerusakan/42/abc.jpg');
  });
});

describe('isiCocok', () => {
  const b = (...x: number[]) => Uint8Array.from(x);
  const s = (t: string) => Uint8Array.from([...t].map((c) => c.charCodeAt(0)));

  it('mengenali tanda tangan gambar dan PDF', () => {
    expect(isiCocok(b(0xff, 0xd8, 0xff, 0xe0), 'image/jpeg')).toBe(true);
    expect(isiCocok(b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), 'image/png')).toBe(true);
    expect(isiCocok(s('RIFF\0\0\0\0WEBPVP8 '), 'image/webp')).toBe(true);
    expect(isiCocok(s('%PDF-1.7'), 'application/pdf')).toBe(true);
  });

  it('menolak halaman HTML yang mengaku PDF atau gambar', () => {
    expect(isiCocok(s('<html><script>'), 'application/pdf')).toBe(false);
    expect(isiCocok(s('<svg onload=1>'), 'image/png')).toBe(false);
  });

  it('menolak isi yang terlalu pendek', () => {
    expect(isiCocok(b(0xff), 'image/jpeg')).toBe(false);
  });
});

describe('periksaTujuan', () => {
  it('foto alat hanya boleh gambar', () => {
    expect(periksaTujuan('ALAT', 'GAMBAR', 'image/png', ['PENGELOLA'])).toBeNull();
    expect(periksaTujuan('ALAT', 'GAMBAR', 'application/pdf', ['PENGELOLA'])?.kode).toBe('TIPE');
  });

  it('manual dan sertifikat menerima PDF', () => {
    expect(periksaTujuan('ALAT', 'MANUAL', 'application/pdf', ['ADMIN_UNIT'])).toBeNull();
    expect(periksaTujuan('ALAT_SERTIFIKAT', 'SERTIFIKAT', 'application/pdf', ['ADMIN_SUPER'])).toBeNull();
  });

  it('menolak peminjam biasa mengubah berkas master data', () => {
    expect(periksaTujuan('ALAT', 'GAMBAR', 'image/png', ['PEMINJAM'])?.kode).toBe('PERAN');
    expect(periksaTujuan('ALAT_SERTIFIKAT', 'SERTIFIKAT', null, ['STAF'])?.kode).toBe('PERAN');
  });

  it('menolak jenis yang tidak dikenal', () => {
    expect(periksaTujuan('ALAT', 'SERTIFIKAT', 'application/pdf', ['PENGELOLA'])?.kode).toBe('JENIS');
  });

  it('entitas alur lain tidak diatur di sini', () => {
    expect(periksaTujuan('SERAH_TERIMA', 'TANDA_TANGAN', 'image/png', ['PEMINJAM'])).toBeNull();
  });
});
