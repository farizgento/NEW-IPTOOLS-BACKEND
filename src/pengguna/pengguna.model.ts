/**
 * Bentuk data pengguna di lapisan aplikasi.
 *
 * Berkas ini sengaja tanpa dekorator dan tanpa ketergantungan pada Nest maupun
 * Oracle, supaya aturannya dapat diuji sebagai fungsi biasa.
 */

export const PERAN = [
  'PEMINJAM',
  'PENGELOLA',
  'MANAJER',
  'GM',
  'STAF',
  'ADMIN_UNIT',
  'ADMIN_SUPER',
] as const;

export type Peran = (typeof PERAN)[number];

/** Dari mana nilai unit atau jabatan berasal (PRD 6.2.1). */
export type SumberData = 'HR' | 'AD' | 'IMPOR' | 'MIGRASI' | 'ADMIN' | 'SWADAYA';

export interface Pengguna {
  id: number;
  nama: string;
  email: string;
  username: string | null;
  nipeg: string | null;
  unitId: number | null;
  namaUnit: string | null;
  jabatan: string | null;
  sumberUnit: SumberData | null;
  aktif: boolean;
  peran: Peran[];
}

/** Baris mentah hasil kueri; nama kolom mengikuti Oracle (huruf besar). */
export interface BarisPengguna extends Record<string, unknown> {
  ID: number;
  NAMA: string;
  EMAIL: string;
  USERNAME: string | null;
  NIPEG: string | null;
  UNIT_ID: number | null;
  NAMA_UNIT: string | null;
  JABATAN: string | null;
  SUMBER_UNIT: string | null;
  DUPLIKAT_DARI: number | null;
  NONAKTIF_PADA: Date | null;
  PERAN: string | null;
}

function bacaPeran(gabungan: string | null): Peran[] {
  if (!gabungan) return [];
  const sah = new Set<string>(PERAN);
  return gabungan
    .split(',')
    .map((p) => p.trim())
    .filter((p): p is Peran => sah.has(p));
}

/**
 * Mengubah satu baris basis data menjadi objek pengguna.
 *
 * Baris yang ditandai `duplikat_dari` adalah salinan hasil pencatatan berulang
 * di sistem lama (PRD 7.3). Baris seperti itu tetap ada demi riwayat, tetapi
 * tidak pernah dianggap aktif.
 */
export function kePengguna(baris: BarisPengguna): Pengguna {
  return {
    id: Number(baris.ID),
    nama: baris.NAMA,
    email: baris.EMAIL,
    username: baris.USERNAME,
    nipeg: baris.NIPEG,
    unitId: baris.UNIT_ID === null ? null : Number(baris.UNIT_ID),
    namaUnit: baris.NAMA_UNIT,
    jabatan: baris.JABATAN,
    sumberUnit: (baris.SUMBER_UNIT as SumberData | null) ?? null,
    aktif: baris.DUPLIKAT_DARI === null && baris.NONAKTIF_PADA === null,
    peran: bacaPeran(baris.PERAN),
  };
}

/** Benar bila pengguna memegang salah satu peran yang diminta. */
export function punyaSalahSatuPeran(pengguna: Pengguna, diminta: readonly Peran[]): boolean {
  if (diminta.length === 0) return true;
  return diminta.some((p) => pengguna.peran.includes(p));
}

/**
 * Pengguna boleh masuk bila barisnya aktif. Peran tidak diperiksa di sini —
 * pengguna tanpa peran pun berhak melihat profilnya sendiri.
 */
export function bolehMasuk(pengguna: Pengguna): boolean {
  return pengguna.aktif;
}

