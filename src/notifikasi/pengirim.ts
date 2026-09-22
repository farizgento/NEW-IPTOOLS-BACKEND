import { Logger } from '@nestjs/common';

/**
 * Pengiriman notifikasi dipisahkan lewat antarmuka ini, sama seperti pemeriksaan
 * identitas pada `auth/identitas.ts`.
 *
 * Sekarang baru ada satu penerapan — pencatat, yang menuliskan pesan ke log
 * tanpa benar-benar mengirimnya. Penerapan surel (SMTP) dan push (OneSignal)
 * menyusul begitu alamat server dan kuncinya tersedia; tidak ada bagian lain
 * yang perlu berubah saat itu terjadi.
 */
export interface PesanKeluar {
  penerimaEmail: string | null;
  kanal: string;
  perihal: string;
  isi: string;
  tautan: string | null;
}

export interface PengirimNotifikasi {
  readonly nama: string;
  kirim(pesan: PesanKeluar): Promise<void>;
}

/**
 * Penerapan sementara: pesan dicatat, tidak dikirim.
 *
 * Dipilih dengan sengaja daripada membiarkan pengiriman gagal diam-diam.
 * Barisnya tetap ditandai terkirim agar jenjang pengingat berikutnya berjalan
 * dan dapat diuji, dan lognya menyatakan terus terang bahwa tidak ada surel
 * yang benar-benar keluar.
 */
export class PengirimPencatat implements PengirimNotifikasi {
  readonly nama = 'pencatat';
  private readonly log = new Logger('Notifikasi');

  async kirim(pesan: PesanKeluar): Promise<void> {
    this.log.log(
      `[TIDAK DIKIRIM — penerapan pencatat] ${pesan.kanal} ke ` +
        `${pesan.penerimaEmail ?? '(tanpa alamat)'}: ${pesan.perihal}`,
    );
  }
}

/**
 * Penerapan surel. Belum aktif: alamat server SMTP belum tersedia.
 *
 * Catatan untuk penerapannya nanti — satu cacat sistem lama yang tidak boleh
 * ikut terbawa: `SEND_MAIL` memanggil `UTL_SMTP` tanpa penangan exception,
 * sehingga kegagalan pengiriman membatalkan pelaporan transaksi bisnis yang
 * sudah selesai. Di sini pengiriman berada di luar transaksi bisnis dan
 * kegagalannya hanya mencatat, tidak pernah membatalkan apa pun.
 */
export class PengirimSurel implements PengirimNotifikasi {
  readonly nama = 'surel';

  async kirim(): Promise<void> {
    throw new Error('Pengirim surel belum dikonfigurasi (SMTP_HOST belum diisi)');
  }
}

export const PENGIRIM_NOTIFIKASI = Symbol('PENGIRIM_NOTIFIKASI');
