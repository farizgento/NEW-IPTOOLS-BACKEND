import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Konfirmasi penerimaan alat — empat jalur, tanpa kamera dan tanpa aplikasi
 * (PRD F8).
 *
 * Sistem lama hanya punya satu jalur: aplikasi Android mTools. Median jeda dari
 * alat dikirim sampai dikonfirmasi diterima 14,3 hari, dan 62,7% lewat sepekan.
 * Penyebabnya bukan lambatnya memindai — melainkan peminjam harus memasang dan
 * membuka aplikasi terpisah.
 */

export type MetodeKonfirmasi = 'TAUTAN' | 'KODE' | 'TANDA_TANGAN' | 'PETUGAS' | 'PINDAI';

/** Jalur yang menuntut alasan tertulis karena bukan peminjam yang mengonfirmasi. */
export const METODE_PERLU_ALASAN: MetodeKonfirmasi[] = ['PETUGAS'];

/** Jalur yang hanya boleh dipakai pengelola. */
export const METODE_KHUSUS_PENGELOLA: MetodeKonfirmasi[] = ['PETUGAS', 'TANDA_TANGAN'];

export const UMUR_TAUTAN_HARI = 30;
export const BATAS_PERCOBAAN_KODE = 5;

/**
 * Kode konfirmasi enam digit yang tercetak pada dokumen serah terima.
 *
 * Dibangkitkan dengan sumber acak kriptografis, bukan Math.random: kode ini
 * satu-satunya pembuktian pada jalur 2, jadi tidak boleh dapat ditebak.
 */
export function buatKodeKonfirmasi(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Perbandingan yang tidak membocorkan posisi karakter yang salah. */
export function kodeCocok(diberikan: string, tersimpan: string | null): boolean {
  if (!tersimpan) return false;
  const a = Buffer.from(diberikan.trim());
  const b = Buffer.from(tersimpan.trim());
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface IsiTautan {
  serahTerimaId: number;
  penerimaId: number;
  kedaluwarsa: number;
}

/**
 * Tautan sekali-ketuk (jalur 1).
 *
 * Ditandatangani, terikat satu serah terima dan satu penerima, berumur
 * terbatas. Membukanya tidak memberi akses ke data lain — hanya ke layar
 * konfirmasi serah terima itu.
 */
export function buatTautan(isi: Omit<IsiTautan, 'kedaluwarsa'>, rahasia: string): string {
  const kedaluwarsa = Date.now() + UMUR_TAUTAN_HARI * 86_400_000;
  const muatan = `${isi.serahTerimaId}.${isi.penerimaId}.${kedaluwarsa}`;
  const tanda = createHmac('sha256', rahasia).update(muatan).digest('base64url');
  return `${muatan}.${tanda}`;
}

export interface HasilTautan {
  sah: boolean;
  isi?: IsiTautan;
  alasan?: string;
}

export function bacaTautan(token: string, rahasia: string): HasilTautan {
  const bagian = token.split('.');
  if (bagian.length !== 4) return { sah: false, alasan: 'Bentuk tautan tidak dikenali' };

  const [serah, penerima, kedaluwarsa, tanda] = bagian as [string, string, string, string];
  const muatan = `${serah}.${penerima}.${kedaluwarsa}`;
  const harusnya = createHmac('sha256', rahasia).update(muatan).digest('base64url');

  const a = Buffer.from(tanda);
  const b = Buffer.from(harusnya);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { sah: false, alasan: 'Tanda tangan tautan tidak cocok' };
  }

  const batas = Number(kedaluwarsa);
  if (!Number.isFinite(batas) || batas < Date.now()) {
    return { sah: false, alasan: 'Tautan sudah kedaluwarsa' };
  }

  return {
    sah: true,
    isi: {
      serahTerimaId: Number(serah),
      penerimaId: Number(penerima),
      kedaluwarsa: batas,
    },
  };
}

export interface PemeriksaanMetode {
  boleh: boolean;
  alasan?: string;
}

/**
 * Memeriksa apakah sebuah metode konfirmasi boleh dipakai orang ini.
 *
 * Jalur "petugas mengonfirmasi atas nama peminjam" adalah jalur terakhir: hanya
 * pengelola, dan wajib beralasan. Tanpa pembatasan itu, jalur darurat akan
 * menjadi jalur utama dan konfirmasi kehilangan artinya.
 */
export function periksaMetode(
  metode: MetodeKonfirmasi,
  adalahPengelola: boolean,
  alasan: string | null | undefined,
): PemeriksaanMetode {
  if (METODE_KHUSUS_PENGELOLA.includes(metode) && !adalahPengelola) {
    return {
      boleh: false,
      alasan: `Metode ${metode} hanya dapat dipakai pengelola alat`,
    };
  }
  if (METODE_PERLU_ALASAN.includes(metode) && !alasan?.trim()) {
    return {
      boleh: false,
      alasan: 'Konfirmasi atas nama peminjam wajib disertai alasan',
    };
  }
  return { boleh: true };
}

/**
 * Status pengajuan setelah sejumlah alat dikonfirmasi.
 *
 * Aturan lama dipertahankan apa adanya: pengajuan menjadi RECEIVED hanya
 * setelah SELURUH alat pada satu serah terima dikonfirmasi. Bila masih ada
 * sisa, statusnya PARTIAL RECEIVED — dan halaman menyatakannya terus terang
 * agar pengguna tidak mengira prosesnya sudah tuntas (PRD F9).
 */
export function statusSetelahTerima(
  jumlahAlat: number,
  sudahDikonfirmasi: number,
  arah: 'KIRIM' | 'KEMBALI',
): string {
  const tuntas = sudahDikonfirmasi >= jumlahAlat;
  if (arah === 'KEMBALI') return tuntas ? 'RETURN' : 'PARTIAL RETURN';
  return tuntas ? 'RECEIVED' : 'PARTIAL RECEIVED';
}

/**
 * Status pengajuan setelah alat diserahkan (PRD F7).
 *
 * Bila hanya sebagian alat pada pengajuan yang diserahkan, statusnya PARTIAL
 * SENT. Penulisan ulang pertama selalu memberi SENT, sehingga pengajuan yang
 * separuh alatnya masih di gudang tampak sudah terkirim penuh.
 */
export function statusSetelahSerah(
  jumlahAlatPengajuan: number,
  sudahDiserahkan: number,
  arah: 'KIRIM' | 'KEMBALI',
): string {
  const tuntas = sudahDiserahkan >= jumlahAlatPengajuan;
  if (arah === 'KEMBALI') return tuntas ? 'RETURN' : 'PARTIAL RETURN';
  return tuntas ? 'SENT' : 'PARTIAL SENT';
}

/**
 * Alamat lengkap tautan konfirmasi yang dikirim ke peminjam (PRD F8 jalur 1).
 *
 * Pesan lama hanya memuat token, sehingga penerima tidak punya apa pun untuk
 * diketuk. Halaman tujuannya terbuka tanpa login.
 */
export function alamatTautan(webUrl: string, token: string): string {
  return `${webUrl.replace(/\/+$/, '')}/k/${encodeURIComponent(token)}`;
}

/**
 * Alat yang belum dinilai kondisinya pada tahap yang disyaratkan (PRD F7, F11).
 *
 * Aturan sistem lama (`INSERT_UPDATE_DATA_CART_SJTOOL`): hanya alat yang sudah
 * diisi penilaian kondisinya yang boleh masuk dokumen serah terima. Berlaku
 * untuk serah terima penuh maupun ringkas — pada varian ambil di gudang,
 * petugas menilai saat menyiapkan (keputusan pemilik proses, PRD 9.2.1).
 */
export function alatBelumDinilai(peminjamanAlatIds: number[], sudahDinilai: ReadonlySet<number>): number[] {
  return peminjamanAlatIds.filter((id) => !sudahDinilai.has(id));
}

/**
 * Tahap penilaian yang wajib ada sebelum alat masuk dokumen, per arah.
 *
 * Kirim: tahap SENT, dinilai petugas saat menyiapkan. Kembali: tahap RETURN,
 * dinilai petugas gudang saat menerima alat kembali. Di sistem lama tahap
 * RETURN umumnya diisi peminjam; di sistem baru peminjam tidak menilai kondisi
 * sama sekali (keputusan pemilik proses, PRD F11).
 */
export function syaratPenilaian(arah: 'KIRIM' | 'KEMBALI', jumlahBelum: number) {
  return arah === 'KIRIM'
    ? {
        tahap: 'SENT' as const,
        code: 'PENILAIAN_KIRIM_BELUM',
        message: `${jumlahBelum} alat belum dinilai kondisinya. Nilai kondisi setiap alat sebelum diserahkan.`,
      }
    : {
        tahap: 'RETURN' as const,
        code: 'PENILAIAN_KEMBALI_BELUM',
        message: `${jumlahBelum} alat belum dinilai kondisinya saat dikembalikan. Nilai kondisi setiap alat sebelum masuk dokumen pengembalian.`,
      };
}
