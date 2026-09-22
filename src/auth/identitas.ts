/**
 * Pemeriksaan identitas dipisahkan dari sisa aplikasi lewat antarmuka ini.
 *
 * Sekarang baru ada satu penerapan — jalan pintas pengembangan lokal. Penerapan
 * direktori (LDAP/Active Directory) menyusul begitu alamat server dan akun uji
 * tersedia; tidak ada bagian lain yang perlu berubah saat itu terjadi.
 */
export interface PenyediaIdentitas {
  readonly nama: string;
  /** Benar bila pasangan username dan sandi sah menurut penyedia ini. */
  periksa(username: string, sandi: string): Promise<boolean>;
}

/**
 * Menerima username apa pun tanpa memeriksa sandi.
 *
 * HANYA untuk pengembangan lokal. Konfigurasi menolak menyala bila ini aktif
 * saat NODE_ENV=production (lihat konfigurasi/konfigurasi.ts), sehingga tidak
 * bisa ikut terbawa ke lingkungan nyata karena kelalaian.
 */
export class PenyediaLewati implements PenyediaIdentitas {
  readonly nama = 'lewati-direktori';

  async periksa(username: string): Promise<boolean> {
    return username.trim().length > 0;
  }
}

/**
 * Penerapan direktori. Belum aktif: alamat server dan akun uji belum tersedia.
 *
 * Catatan untuk penerapannya nanti — dua cacat sistem lama yang tidak boleh
 * ikut terbawa:
 *   1. Filter pencarian dirangkai dari username mentah, sehingga terbuka
 *      terhadap penyisipan LDAP. Nilai apa pun dari pengguna wajib di-escape.
 *   2. Ada sandi utama yang membuat siapa pun bisa masuk sebagai siapa pun.
 *      Tidak boleh ada jalan pintas semacam itu.
 *
 * Saat mengaktifkannya, sekalian baca atribut `department` dan `title` dari
 * direktori — keduanya dapat mengisi unit dan jabatan tanpa menunggu akses
 * basis data kepegawaian (PRD 6.2.1 sumber 1).
 */
export class PenyediaDirektori implements PenyediaIdentitas {
  readonly nama = 'direktori';

  async periksa(): Promise<boolean> {
    throw new Error(
      'Penyedia direktori belum dikonfigurasi. ' +
        'Untuk pengembangan lokal, setel AUTH_LEWATI_DIREKTORI=true.',
    );
  }
}

export const PENYEDIA_IDENTITAS = Symbol('PENYEDIA_IDENTITAS');
