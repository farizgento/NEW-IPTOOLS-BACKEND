"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.validasiPengajuan = validasiPengajuan;
exports.ringkasDugaanKembar = ringkasDugaanKembar;
const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
function validasiPengajuan(masukan) {
    const salah = [];
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
function ringkasDugaanKembar(dugaan) {
    if (!dugaan.length)
        return null;
    const daftar = dugaan.map((d) => `${d.namaAlat} (pengajuan #${d.peminjamanId}, ${d.status})`);
    return `Anda masih punya pengajuan berjalan untuk alat berikut: ${daftar.join('; ')}`;
}
//# sourceMappingURL=validasi.js.map