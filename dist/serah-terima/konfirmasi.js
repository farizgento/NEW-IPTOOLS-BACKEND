"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BATAS_PERCOBAAN_KODE = exports.UMUR_TAUTAN_HARI = exports.METODE_KHUSUS_PENGELOLA = exports.METODE_PERLU_ALASAN = void 0;
exports.buatKodeKonfirmasi = buatKodeKonfirmasi;
exports.kodeCocok = kodeCocok;
exports.buatTautan = buatTautan;
exports.bacaTautan = bacaTautan;
exports.periksaMetode = periksaMetode;
exports.statusSetelahTerima = statusSetelahTerima;
exports.statusSetelahSerah = statusSetelahSerah;
exports.alamatTautan = alamatTautan;
exports.alatBelumDinilai = alatBelumDinilai;
exports.syaratPenilaian = syaratPenilaian;
const node_crypto_1 = require("node:crypto");
/** Jalur yang menuntut alasan tertulis karena bukan peminjam yang mengonfirmasi. */
exports.METODE_PERLU_ALASAN = ['PETUGAS'];
/** Jalur yang hanya boleh dipakai pengelola. */
exports.METODE_KHUSUS_PENGELOLA = ['PETUGAS', 'TANDA_TANGAN'];
exports.UMUR_TAUTAN_HARI = 30;
exports.BATAS_PERCOBAAN_KODE = 5;
/**
 * Kode konfirmasi enam digit yang tercetak pada dokumen serah terima.
 *
 * Dibangkitkan dengan sumber acak kriptografis, bukan Math.random: kode ini
 * satu-satunya pembuktian pada jalur 2, jadi tidak boleh dapat ditebak.
 */
function buatKodeKonfirmasi() {
    return String((0, node_crypto_1.randomInt)(0, 1_000_000)).padStart(6, '0');
}
/** Perbandingan yang tidak membocorkan posisi karakter yang salah. */
function kodeCocok(diberikan, tersimpan) {
    if (!tersimpan)
        return false;
    const a = Buffer.from(diberikan.trim());
    const b = Buffer.from(tersimpan.trim());
    if (a.length !== b.length)
        return false;
    return (0, node_crypto_1.timingSafeEqual)(a, b);
}
/**
 * Tautan sekali-ketuk (jalur 1).
 *
 * Ditandatangani, terikat satu serah terima dan satu penerima, berumur
 * terbatas. Membukanya tidak memberi akses ke data lain — hanya ke layar
 * konfirmasi serah terima itu.
 */
function buatTautan(isi, rahasia) {
    const kedaluwarsa = Date.now() + exports.UMUR_TAUTAN_HARI * 86_400_000;
    const muatan = `${isi.serahTerimaId}.${isi.penerimaId}.${kedaluwarsa}`;
    const tanda = (0, node_crypto_1.createHmac)('sha256', rahasia).update(muatan).digest('base64url');
    return `${muatan}.${tanda}`;
}
function bacaTautan(token, rahasia) {
    const bagian = token.split('.');
    if (bagian.length !== 4)
        return { sah: false, alasan: 'Bentuk tautan tidak dikenali' };
    const [serah, penerima, kedaluwarsa, tanda] = bagian;
    const muatan = `${serah}.${penerima}.${kedaluwarsa}`;
    const harusnya = (0, node_crypto_1.createHmac)('sha256', rahasia).update(muatan).digest('base64url');
    const a = Buffer.from(tanda);
    const b = Buffer.from(harusnya);
    if (a.length !== b.length || !(0, node_crypto_1.timingSafeEqual)(a, b)) {
        return { sah: false, alasan: 'Tanda tangan tautan tidak cocok' };
    }
    const batas = Number(kedaluwarsa);
    if (!Number.isFinite(batas) || batas < Date.now()) {
        return { sah: false, alasan: 'Tautan sudah kedaluwarsa' };
    }
    return {
        sah: true,
        isi: {
            serahTerimaId: Number(serah),
            penerimaId: Number(penerima),
            kedaluwarsa: batas,
        },
    };
}
/**
 * Memeriksa apakah sebuah metode konfirmasi boleh dipakai orang ini.
 *
 * Jalur "petugas mengonfirmasi atas nama peminjam" adalah jalur terakhir: hanya
 * pengelola, dan wajib beralasan. Tanpa pembatasan itu, jalur darurat akan
 * menjadi jalur utama dan konfirmasi kehilangan artinya.
 */
function periksaMetode(metode, adalahPengelola, alasan) {
    if (exports.METODE_KHUSUS_PENGELOLA.includes(metode) && !adalahPengelola) {
        return {
            boleh: false,
            alasan: `Metode ${metode} hanya dapat dipakai pengelola alat`,
        };
    }
    if (exports.METODE_PERLU_ALASAN.includes(metode) && !alasan?.trim()) {
        return {
            boleh: false,
            alasan: 'Konfirmasi atas nama peminjam wajib disertai alasan',
        };
    }
    return { boleh: true };
}
/**
 * Status pengajuan setelah sejumlah alat dikonfirmasi.
 *
 * Aturan lama dipertahankan apa adanya: pengajuan menjadi RECEIVED hanya
 * setelah SELURUH alat pada satu serah terima dikonfirmasi. Bila masih ada
 * sisa, statusnya PARTIAL RECEIVED — dan halaman menyatakannya terus terang
 * agar pengguna tidak mengira prosesnya sudah tuntas (PRD F9).
 */
function statusSetelahTerima(jumlahAlat, sudahDikonfirmasi, arah) {
    const tuntas = sudahDikonfirmasi >= jumlahAlat;
    if (arah === 'KEMBALI')
        return tuntas ? 'RETURN' : 'PARTIAL RETURN';
    return tuntas ? 'RECEIVED' : 'PARTIAL RECEIVED';
}
/**
 * Status pengajuan setelah alat diserahkan (PRD F7).
 *
 * Bila hanya sebagian alat pada pengajuan yang diserahkan, statusnya PARTIAL
 * SENT. Penulisan ulang pertama selalu memberi SENT, sehingga pengajuan yang
 * separuh alatnya masih di gudang tampak sudah terkirim penuh.
 */
function statusSetelahSerah(jumlahAlatPengajuan, sudahDiserahkan, arah) {
    const tuntas = sudahDiserahkan >= jumlahAlatPengajuan;
    if (arah === 'KEMBALI')
        return tuntas ? 'RETURN' : 'PARTIAL RETURN';
    return tuntas ? 'SENT' : 'PARTIAL SENT';
}
/**
 * Alamat lengkap tautan konfirmasi yang dikirim ke peminjam (PRD F8 jalur 1).
 *
 * Pesan lama hanya memuat token, sehingga penerima tidak punya apa pun untuk
 * diketuk. Halaman tujuannya terbuka tanpa login.
 */
function alamatTautan(webUrl, token) {
    return `${webUrl.replace(/\/+$/, '')}/k/${encodeURIComponent(token)}`;
}
/**
 * Alat yang belum dinilai kondisinya pada tahap yang disyaratkan (PRD F7, F11).
 *
 * Aturan sistem lama (`INSERT_UPDATE_DATA_CART_SJTOOL`): hanya alat yang sudah
 * diisi penilaian kondisinya yang boleh masuk dokumen serah terima. Berlaku
 * untuk serah terima penuh maupun ringkas — pada varian ambil di gudang,
 * petugas menilai saat menyiapkan (keputusan pemilik proses, PRD 9.2.1).
 */
function alatBelumDinilai(peminjamanAlatIds, sudahDinilai) {
    return peminjamanAlatIds.filter((id) => !sudahDinilai.has(id));
}
/**
 * Tahap penilaian yang wajib ada sebelum alat masuk dokumen, per arah.
 *
 * Kirim: tahap SENT, dinilai petugas saat menyiapkan. Kembali: tahap RETURN,
 * dinilai petugas gudang saat menerima alat kembali. Di sistem lama tahap
 * RETURN umumnya diisi peminjam; di sistem baru peminjam tidak menilai kondisi
 * sama sekali (keputusan pemilik proses, PRD F11).
 */
function syaratPenilaian(arah, jumlahBelum) {
    return arah === 'KIRIM'
        ? {
            tahap: 'SENT',
            code: 'PENILAIAN_KIRIM_BELUM',
            message: `${jumlahBelum} alat belum dinilai kondisinya. Nilai kondisi setiap alat sebelum diserahkan.`,
        }
        : {
            tahap: 'RETURN',
            code: 'PENILAIAN_KEMBALI_BELUM',
            message: `${jumlahBelum} alat belum dinilai kondisinya saat dikembalikan. Nilai kondisi setiap alat sebelum masuk dokumen pengembalian.`,
        };
}
//# sourceMappingURL=konfirmasi.js.map