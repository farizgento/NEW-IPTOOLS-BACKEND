/**
 * Validasi pengajuan sebelum dikirim (PRD F2).
 *
 * Data produksi menunjukkan median 259 jam menunggu hanya untuk ditolak, dan
 * 93% penolakan tanpa alasan spesifik. Alasan konkret yang muncul — "mohon di
 * isi nomor wo", "isi nomor wo" — seluruhnya dapat dicegah di sini.
 *
 * Aturan yang sama dipakai antarmuka untuk menonaktifkan tombol kirim, dan
 * ditegakkan ulang di server. Antarmuka boleh dilewati; server tidak.
 */

export interface MasukanPengajuan {
  pekerjaan?: string | null;
  nomorWo?: string | null;
  tanggalMulai?: string | null;
  tanggalSelesai?: string | null;
  alatIds: number[];
}

export interface Pelanggaran {
  field: string;
  message: string;
}

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

export function validasiPengajuan(masukan: MasukanPengajuan): Pelanggaran[] {
  const salah: Pelanggaran[] = [];

  if (!masukan.alatIds.length) {
    salah.push({ field: 'alatIds', message: 'Pilih setidaknya satu alat' });
  }
  if (new Set(masukan.alatIds).size !== masukan.alatIds.length) {
    salah.push({ field: 'alatIds', message: 'Ada alat yang terpilih lebih dari sekali' });
  }

  if (!masukan.pekerjaan?.trim()) {
    salah.push({ field: 'pekerjaan', message: 'Pekerjaan wajib diisi' });
  }

  // Penyebab penolakan yang paling sering muncul di data produksi.
  if (!masukan.nomorWo?.trim()) {
    salah.push({ field: 'nomorWo', message: 'Nomor WO wajib diisi' });
  }

  const mulai = masukan.tanggalMulai?.trim();
  const selesai = masukan.tanggalSelesai?.trim();

  if (!mulai || !POLA_TANGGAL.test(mulai)) {
    salah.push({ field: 'tanggalMulai', message: 'Tanggal mulai wajib diisi (YYYY-MM-DD)' });
  }
  if (!selesai || !POLA_TANGGAL.test(selesai)) {
    salah.push({ field: 'tanggalSelesai', message: 'Tanggal selesai wajib diisi (YYYY-MM-DD)' });
  }
  if (mulai && selesai && POLA_TANGGAL.test(mulai) && POLA_TANGGAL.test(selesai)) {
    if (selesai < mulai) {
      salah.push({
        field: 'tanggalSelesai',
        message: 'Tanggal selesai tidak boleh mendahului tanggal mulai',
      });
    }
  }

  return salah;
}

/**
 * Dugaan pengajuan kembar: alat yang sama, oleh orang yang sama, sementara
 * pengajuan sebelumnya belum selesai.
 *
 * Sengaja berupa peringatan, bukan penolakan — meminjam alat yang sama dua kali
 * bisa saja sah. Pengguna meneruskan setelah mengonfirmasi.
 */
export interface DugaanKembar {
  alatId: number;
  namaAlat: string;
  peminjamanId: number;
  status: string;
}

export function ringkasDugaanKembar(dugaan: DugaanKembar[]): string | null {
  if (!dugaan.length) return null;
  const daftar = dugaan.map((d) => `${d.namaAlat} (pengajuan #${d.peminjamanId}, ${d.status})`);
  return `Anda masih punya pengajuan berjalan untuk alat berikut: ${daftar.join('; ')}`;
}
