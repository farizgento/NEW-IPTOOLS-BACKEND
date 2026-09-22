"use strict";
/**
 * Aturan sertifikat kalibrasi alat.
 *
 * Fungsi murni tanpa Nest maupun Oracle supaya dapat diuji sebagai fungsi biasa.
 * Sistem lama hanya menyimpan baris `DAFTAR_TOOL_SERTIFIKAT` apa adanya: tidak
 * ada status, hasilnya ditulis belasan cara, dan tanggal kalibrasi ulang boleh
 * kosong. Status di sini dihitung, bukan disimpan, agar tidak pernah basi.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HARI_SEGERA = void 0;
exports.statusSertifikat = statusSertifikat;
exports.bakukanHasil = bakukanHasil;
exports.kunciPelaksana = kunciPelaksana;
exports.periksaSertifikat = periksaSertifikat;
exports.saranSetahun = saranSetahun;
exports.HARI_SEGERA = 90;
const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const selisihHari = (dari, sampai) => Math.round((Date.parse(sampai) - Date.parse(dari)) / 86_400_000);
/**
 * Status dihitung dari tanggal kalibrasi ulang terhadap hari ini.
 * Kedaluwarsa hanya menjadi peringatan; alat tetap boleh dipinjam
 * (keputusan 2026-09-17), jadi status tidak pernah dipakai untuk menolak.
 */
function statusSertifikat(tanggalSaran, hariIni) {
    if (!tanggalSaran)
        return { status: 'TANPA_TANGGAL', sisaHari: null };
    const sisa = selisihHari(hariIni, tanggalSaran);
    if (sisa < 0)
        return { status: 'LEWAT', sisaHari: sisa };
    if (sisa <= exports.HARI_SEGERA)
        return { status: 'SEGERA', sisaHari: sisa };
    return { status: 'BERLAKU', sisaHari: sisa };
}
/**
 * Hasil kalibrasi data lama ditulis belasan cara ("Baik", "BAIK", "sesuai",
 * "Good condition and ready to use"). Semuanya dibakukan menjadi dua nilai
 * supaya laporan dan saringan tidak terpecah.
 */
function bakukanHasil(teks) {
    const t = String(teks ?? '').trim();
    if (!t)
        return null;
    if (/tidak|gagal|reject|rusak/i.test(t))
        return 'TIDAK SESUAI';
    if (/baik|sesua|siap|good|diterima|pass|ok/i.test(t))
        return 'BAIK';
    return t.toUpperCase();
}
/**
 * Nama pelaksana ditulis berbeda-beda ("PT Delta Instrumentasi",
 * "PT. DELTA INSTRUMENTASI"). Kunci ini menyatukannya untuk pengelompokan,
 * sementara nama aslinya tetap disimpan apa adanya.
 */
function kunciPelaksana(nama) {
    return String(nama ?? '')
        .toUpperCase()
        .split('(PERSERO)')
        .join(' ')
        .replace(/[^A-Z0-9]+/g, ' ')
        .trim()
        .replace(/^PT /, '');
}
/** Isian sertifikat diperiksa di sini, bukan lewat constraint basis data. */
function periksaSertifikat(isi, hariIni) {
    const salah = [];
    if (!isi.nomor.trim())
        salah.push({ field: 'nomor', message: 'Nomor sertifikat wajib diisi' });
    if (isi.nomor.trim().length > 255)
        salah.push({ field: 'nomor', message: 'Nomor sertifikat maksimal 255 huruf' });
    if (!TANGGAL.test(isi.tanggalKalibrasi))
        salah.push({ field: 'tanggalKalibrasi', message: 'Tanggal kalibrasi wajib diisi' });
    else if (isi.tanggalKalibrasi > hariIni)
        salah.push({ field: 'tanggalKalibrasi', message: 'Tanggal kalibrasi tidak boleh di masa depan' });
    if (isi.tanggalSaran) {
        if (!TANGGAL.test(isi.tanggalSaran))
            salah.push({ field: 'tanggalSaran', message: 'Tanggal kalibrasi ulang tidak sah' });
        else if (TANGGAL.test(isi.tanggalKalibrasi) && isi.tanggalSaran < isi.tanggalKalibrasi)
            salah.push({
                field: 'tanggalSaran',
                message: 'Tanggal kalibrasi ulang mendahului tanggal kalibrasi',
            });
    }
    if ((isi.pelaksana ?? '').length > 255)
        salah.push({ field: 'pelaksana', message: 'Nama pelaksana maksimal 255 huruf' });
    return salah;
}
/** Tanggal kalibrasi ulang bawaan: satu tahun setelah kalibrasi (kebiasaan pelaksana). */
function saranSetahun(tanggalKalibrasi) {
    if (!TANGGAL.test(tanggalKalibrasi))
        return null;
    const [tahun = 0, bulan = 1, tanggal = 1] = tanggalKalibrasi.split('-').map(Number);
    return new Date(Date.UTC(tahun + 1, bulan - 1, tanggal)).toISOString().slice(0, 10);
}
//# sourceMappingURL=sertifikat.js.map