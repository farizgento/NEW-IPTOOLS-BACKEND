"use strict";
/**
 * Aturan daftar proyek/pekerjaan.
 *
 * Peminjam boleh mengetik nama pekerjaan bebas saat mengajukan (keputusan
 * 2026-09-15), jadi daftar proyek bukan pagar melainkan bahan rapi-rapi: nama
 * yang diketik bebas dikumpulkan, lalu admin menambahkannya atau menyamakannya
 * dengan proyek yang sudah ada.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AMBANG_MIRIP = exports.normalNama = void 0;
exports.periksaProyek = periksaProyek;
exports.miripProyek = miripProyek;
const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
/** Pembanding nama: beda spasi dan huruf besar-kecil dianggap sama. */
const normalNama = (nama) => nama.replace(/\s+/g, ' ').trim().toUpperCase();
exports.normalNama = normalNama;
function periksaProyek(isi) {
    const salah = [];
    const nama = isi.nama.trim();
    if (!nama)
        salah.push({ field: 'nama', message: 'Nama pekerjaan wajib diisi' });
    if (nama.length > 255)
        salah.push({ field: 'nama', message: 'Nama pekerjaan maksimal 255 huruf' });
    for (const [field, nilai] of [
        ['tanggalMulai', isi.tanggalMulai],
        ['tanggalSelesai', isi.tanggalSelesai],
    ]) {
        if (nilai && !TANGGAL.test(nilai))
            salah.push({ field, message: 'Tanggal tidak sah' });
    }
    if (isi.tanggalMulai &&
        isi.tanggalSelesai &&
        TANGGAL.test(isi.tanggalMulai) &&
        TANGGAL.test(isi.tanggalSelesai) &&
        isi.tanggalSelesai < isi.tanggalMulai) {
        salah.push({ field: 'tanggalSelesai', message: 'Tanggal selesai mendahului tanggal mulai' });
    }
    if ((isi.site ?? '').length > 255)
        salah.push({ field: 'site', message: 'Lokasi maksimal 255 huruf' });
    return salah;
}
/**
 * Menakar kemiripan dua nama pekerjaan.
 *
 * Dipakai untuk menyarankan "mungkin sama dengan", bukan untuk menggabungkan
 * sendiri. Angka pada nama (Unit 5, Unit 7) harus sama persis — tanpa itu
 * saran malah menyesatkan, seperti yang terjadi di prototipe sebelum ambangnya
 * dinaikkan (catatan 2026-09-16).
 */
function miripProyek(a, b) {
    const potong = (t) => new Set((0, exports.normalNama)(t)
        .replace(/\bUNIT\s+(\d+)\b/g, 'U$1')
        .split(/[^A-Z0-9]+/)
        .filter((k) => k.length > 1));
    const x = potong(a);
    const y = potong(b);
    if (!x.size || !y.size)
        return 0;
    const berangka = (s) => [...s].filter((k) => /\d/.test(k));
    const angkaX = berangka(x).sort().join(',');
    const angkaY = berangka(y).sort().join(',');
    if (angkaX !== angkaY)
        return 0;
    const irisan = [...x].filter((k) => y.has(k)).length;
    return irisan / (x.size + y.size - irisan);
}
/** Ambang saran; di bawah ini dua nama dianggap pekerjaan berbeda. */
exports.AMBANG_MIRIP = 0.8;
//# sourceMappingURL=proyek.js.map