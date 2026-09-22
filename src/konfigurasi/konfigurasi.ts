import { z } from 'zod';

/**
 * Seluruh konfigurasi dibaca dari variabel lingkungan dan divalidasi sekali di
 * awal. Aplikasi menolak menyala bila ada yang salah — lebih baik gagal saat
 * start daripada gagal saat pengguna sedang memakai.
 */
const skema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),

    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().int().positive().default(1521),
    DB_SERVICE: z.string().min(1),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string().min(1),
    DB_POOL_MIN: z.coerce.number().int().min(0).default(1),
    DB_POOL_MAX: z.coerce.number().int().min(1).default(10),

    /** Kunci penanda tangan token. Wajib panjang; tidak boleh ada nilai bawaan. */
    JWT_RAHASIA: z.string().min(32, 'JWT_RAHASIA minimal 32 karakter'),
    JWT_UMUR_DETIK: z.coerce.number().int().positive().default(3600),

    /** Penjadwal pengingat berjenjang (PRD F12). */
    PENGINGAT_AKTIF: z.enum(['true','false']).default('false').transform((v) => v === 'true'),
    PENGINGAT_JEDA_MENIT: z.coerce.number().int().min(1).default(60),

    /** Alamat frontend, dipakai menyusun tautan konfirmasi di pesan (PRD F8 jalur 1). */
    WEB_URL: z.string().url().default('http://localhost:5173'),

    /** Direktori penyimpanan berkas lampiran. */
    LAMPIRAN_DIREKTORI: z.string().min(1).default('./data/lampiran'),
    LAMPIRAN_MAKS_BITA: z.coerce.number().int().positive().default(10 * 1024 * 1024),

    /**
     * Melewati autentikasi direktori dan menerima username apa pun yang ada di
     * tabel pengguna, tanpa memeriksa sandi. Untuk pengembangan lokal saja.
     */
    AUTH_LEWATI_DIREKTORI: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
  })
  .superRefine((nilai, ctx) => {
    // Pengaman yang tidak bisa dilupakan: jalur pintas autentikasi tidak boleh
    // hidup di produksi, apa pun isi berkas .env-nya.
    if (nilai.NODE_ENV === 'production' && nilai.AUTH_LEWATI_DIREKTORI) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_LEWATI_DIREKTORI'],
        message:
          'AUTH_LEWATI_DIREKTORI tidak boleh true saat NODE_ENV=production. ' +
          'Jalur pintas ini menerima siapa pun tanpa sandi.',
      });
    }
  });

export type Konfigurasi = z.infer<typeof skema>;

export function bacaKonfigurasi(sumber: NodeJS.ProcessEnv = process.env): Konfigurasi {
  const hasil = skema.safeParse(sumber);
  if (!hasil.success) {
    const rincian = hasil.error.issues
      .map((i) => `  - ${i.path.join('.') || '(akar)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Konfigurasi tidak sah:\n${rincian}`);
  }
  return hasil.data;
}

export const KONFIGURASI = Symbol('KONFIGURASI');
