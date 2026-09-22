/**
 * Aturan jadwal pemakaian alat (dashboard gantchart).
 *
 * Fungsi murni: status batang dan deteksi jadwal bertabrakan. Sistem lama tidak
 * punya tampilan jadwal sama sekali, sehingga dua peminjaman pada alat yang sama
 * dengan periode bertumpuk baru ketahuan saat petugas gudang kehabisan alat.
 */

export type StatusJadwal = 'DIJADWALKAN' | 'DIPAKAI' | 'LEWAT' | 'SELESAI';

export interface Jadwal {
  peminjamanAlatId: number;
  peminjamanId: number;
  alatId: number;
  mulai: string;
  selesai: string;
  statusAlat: string | null;
  tanggalKembali: string | null;
}

export interface JadwalBerstatus extends Jadwal {
  status: StatusJadwal;
  jalur: number;
  tabrakDengan: number[];
}

/** Dua periode dianggap bertabrakan bila harinya bertumpuk, termasuk hari batas. */
export const bertumpuk = (a: { mulai: string; selesai: string }, b: { mulai: string; selesai: string }): boolean =>
  a.mulai <= b.selesai && b.mulai <= a.selesai;

/**
 * Status dihitung dari status alat pada peminjaman, bukan disimpan.
 * Alat yang masih di tangan peminjam melewati tanggal selesai ditandai LEWAT —
 * inilah yang dulu hanya terlihat setelah petugas menghitung manual.
 */
export function statusJadwal(j: Jadwal, hariIni: string): StatusJadwal {
  if (j.tanggalKembali || j.statusAlat === 'SELESAI') return 'SELESAI';
  if (j.statusAlat === 'DIKIRIM' || j.statusAlat === 'DITERIMA')
    return j.selesai < hariIni ? 'LEWAT' : 'DIPAKAI';
  return j.selesai < hariIni ? 'SELESAI' : 'DIJADWALKAN';
}

/**
 * Menandai jadwal yang bertumpuk pada satu alat dan membagi jalur tampilannya.
 *
 * Jalur dipakai antarmuka agar dua batang yang bertumpuk tidak saling menutupi;
 * dihitung di sini supaya web dan laporan memakai angka yang sama.
 */
export function tandaiTabrakan(isi: Jadwal[], hariIni: string): JadwalBerstatus[] {
  const urut = [...isi].sort(
    (a, b) => a.mulai.localeCompare(b.mulai) || a.selesai.localeCompare(b.selesai),
  );
  const akhirJalur: string[] = [];
  return urut.map((j, i) => {
    const tabrakDengan = urut
      .filter((lain, k) => k !== i && bertumpuk(j, lain))
      .map((lain) => lain.peminjamanAlatId);
    const bebas = akhirJalur.findIndex((akhir) => akhir < j.mulai);
    const jalur = bebas === -1 ? akhirJalur.length : bebas;
    akhirJalur[jalur] = j.selesai;
    return { ...j, status: statusJadwal(j, hariIni), jalur, tabrakDengan };
  });
}

/** Ringkasan untuk kartu angka di kepala dashboard. */
export function ringkasJadwal(
  perAlat: { jadwal: JadwalBerstatus[] }[],
): { dipakai: number; dijadwalkan: number; lewat: number; selesai: number; alatBertabrakan: number } {
  const hitung = { dipakai: 0, dijadwalkan: 0, lewat: 0, selesai: 0, alatBertabrakan: 0 };
  for (const alat of perAlat) {
    if (alat.jadwal.some((j) => j.tabrakDengan.length)) hitung.alatBertabrakan += 1;
    for (const j of alat.jadwal) {
      if (j.status === 'DIPAKAI') hitung.dipakai += 1;
      else if (j.status === 'DIJADWALKAN') hitung.dijadwalkan += 1;
      else if (j.status === 'LEWAT') hitung.lewat += 1;
      else hitung.selesai += 1;
    }
  }
  return hitung;
}
