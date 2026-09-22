/**
 * Penilaian kondisi alat berbasis pengecualian (PRD F6).
 *
 * Tabel penilaian adalah yang terbesar di sistem: 83.220 baris, 56% dari
 * seluruh isi basis data. Rata-rata 34 baris per pengajuan, diisi manual.
 *
 * Bentuk datanya tidak berubah — tetap satu baris per alat per tahap per
 * kategori. Yang berubah cara mengisinya: kasus "semua alat kondisi baik"
 * cukup satu tindakan, dan hanya yang menyimpang yang dibuka rinciannya.
 */

export type TahapPenilaian = 'BOOKED' | 'SENT' | 'RETURN' | 'FINISH' | 'KERUSAKAN';

export interface PilihanKategori {
  id: number;
  grup: number;
  keterangan: string;
  bobot: number;
  nilai: number;
}

export interface PenilaianAlat {
  peminjamanAlatId: number;
  /** Id pilihan kategori, satu per grup. */
  pilihanIds: number[];
  keterangan?: Record<number, string> | undefined;
}

export interface Pelanggaran {
  field: string;
  message: string;
}

/** Lima grup penilaian, bobotnya berjumlah 100. */
export const JUMLAH_GRUP = 5;

/**
 * Pilihan bernilai 100 pada tiap grup — inilah yang dipakai jalur
 * "semua alat kondisi baik".
 */
export function pilihanKondisiBaik(semua: PilihanKategori[]): PilihanKategori[] {
  const perGrup = new Map<number, PilihanKategori>();
  for (const p of semua) {
    if (p.nilai !== 100) continue;
    const ada = perGrup.get(p.grup);
    // Bila satu grup punya lebih dari satu pilihan bernilai 100, ambil yang
    // idnya terkecil agar hasilnya tetap sama setiap kali dijalankan.
    if (!ada || p.id < ada.id) perGrup.set(p.grup, p);
  }
  return [...perGrup.values()].sort((a, b) => a.grup - b.grup);
}

/** Benar bila seluruh grup punya pilihan bernilai 100. */
export function kondisiBaikLengkap(semua: PilihanKategori[]): boolean {
  return pilihanKondisiBaik(semua).length === JUMLAH_GRUP;
}

/**
 * Memvalidasi satu penilaian alat.
 *
 * Keterangan hanya wajib bila pilihannya bukan kondisi penuh — itulah inti
 * "berbasis pengecualian". Menuntut keterangan pada setiap kategori adalah
 * yang membuat pengisian lama begitu berat.
 */
export function validasiPenilaian(
  penilaian: PenilaianAlat,
  katalog: Map<number, PilihanKategori>,
): Pelanggaran[] {
  const salah: Pelanggaran[] = [];
  const grupTerpakai = new Set<number>();

  if (!penilaian.pilihanIds.length) {
    salah.push({ field: 'pilihanIds', message: 'Pilih kondisi untuk setiap kategori' });
    return salah;
  }

  for (const id of penilaian.pilihanIds) {
    const pilihan = katalog.get(id);
    if (!pilihan) {
      salah.push({ field: `pilihan.${id}`, message: 'Pilihan kondisi tidak dikenali' });
      continue;
    }
    if (grupTerpakai.has(pilihan.grup)) {
      salah.push({
        field: `pilihan.${id}`,
        message: `Grup ${pilihan.grup} dipilih lebih dari sekali`,
      });
    }
    grupTerpakai.add(pilihan.grup);

    if (pilihan.nilai !== 100 && !penilaian.keterangan?.[id]?.trim()) {
      salah.push({
        field: `keterangan.${id}`,
        message: `Keterangan wajib diisi untuk "${pilihan.keterangan}"`,
      });
    }
  }

  if (grupTerpakai.size !== JUMLAH_GRUP) {
    salah.push({
      field: 'pilihanIds',
      message: `Kelima kategori wajib dinilai; baru ${grupTerpakai.size} terisi`,
    });
  }

  return salah;
}

/**
 * Nilai keandalan sebuah alat: jumlah (bobot × nilai) dibagi 100.
 *
 * Dihitung, tidak disimpan (PRD 6.1 butir 6). Sistem lama menyalin ringkasannya
 * ke enam kolom di tabel rincian peminjaman, dan nilai itu bisa berbeda dari
 * hasil hitung data pendukungnya.
 */
export function hitungNilai(pilihan: PilihanKategori[]): number {
  const total = pilihan.reduce((jumlah, p) => jumlah + (p.bobot * p.nilai) / 100, 0);
  return Math.round(total * 100) / 100;
}

/** Kategori yang tidak dalam kondisi penuh — dipakai laporan dan ringkasan. */
export function kategoriBermasalah(pilihan: PilihanKategori[]): PilihanKategori[] {
  return pilihan.filter((p) => p.nilai !== 100);
}
