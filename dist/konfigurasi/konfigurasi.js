"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KONFIGURASI = void 0;
exports.bacaKonfigurasi = bacaKonfigurasi;
const zod_1 = require("zod");
/**
 * Seluruh konfigurasi dibaca dari variabel lingkungan dan divalidasi sekali di
 * awal. Aplikasi menolak menyala bila ada yang salah — lebih baik gagal saat
 * start daripada gagal saat pengguna sedang memakai.
 */
const skema = zod_1.z
    .object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    PORT: zod_1.z.coerce.number().int().positive().default(3001),
    DB_HOST: zod_1.z.string().min(1),
    DB_PORT: zod_1.z.coerce.number().int().positive().default(1521),
    DB_SERVICE: zod_1.z.string().min(1),
    DB_USER: zod_1.z.string().min(1),
    DB_PASSWORD: zod_1.z.string().min(1),
    DB_POOL_MIN: zod_1.z.coerce.number().int().min(0).default(1),
    DB_POOL_MAX: zod_1.z.coerce.number().int().min(1).default(10),
    /** Kunci penanda tangan token. Wajib panjang; tidak boleh ada nilai bawaan. */
    JWT_RAHASIA: zod_1.z.string().min(32, 'JWT_RAHASIA minimal 32 karakter'),
    JWT_UMUR_DETIK: zod_1.z.coerce.number().int().positive().default(3600),
    /** Penjadwal pengingat berjenjang (PRD F12). */
    PENGINGAT_AKTIF: zod_1.z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
    PENGINGAT_JEDA_MENIT: zod_1.z.coerce.number().int().min(1).default(60),
    /** Alamat frontend, dipakai menyusun tautan konfirmasi di pesan (PRD F8 jalur 1). */
    WEB_URL: zod_1.z.string().url().default('http://localhost:5173'),
    /** Direktori penyimpanan berkas lampiran. */
    LAMPIRAN_DIREKTORI: zod_1.z.string().min(1).default('./data/lampiran'),
    LAMPIRAN_MAKS_BITA: zod_1.z.coerce.number().int().positive().default(10 * 1024 * 1024),
    /**
     * Melewati autentikasi direktori dan menerima username apa pun yang ada di
     * tabel pengguna, tanpa memeriksa sandi. Untuk pengembangan lokal saja.
     */
    AUTH_LEWATI_DIREKTORI: zod_1.z
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
            message: 'AUTH_LEWATI_DIREKTORI tidak boleh true saat NODE_ENV=production. ' +
                'Jalur pintas ini menerima siapa pun tanpa sandi.',
        });
    }
});
function bacaKonfigurasi(sumber = process.env) {
    const hasil = skema.safeParse(sumber);
    if (!hasil.success) {
        const rincian = hasil.error.issues
            .map((i) => `  - ${i.path.join('.') || '(akar)'}: ${i.message}`)
            .join('\n');
        throw new Error(`Konfigurasi tidak sah:\n${rincian}`);
    }
    return hasil.data;
}
exports.KONFIGURASI = Symbol('KONFIGURASI');
//# sourceMappingURL=konfigurasi.js.map