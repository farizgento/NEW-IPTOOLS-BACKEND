"use strict";
/**
 * Aturan usulan perubahan data alat (docs/aturan-bisnis/usulan-alat.md).
 *
 * Fungsi murni tanpa Nest maupun Oracle. Di sistem lama aturan ini tersebar di
 * INSERT_UPDATE_DAFTAR_TOOL_TEMP dan ACTION_DAFTAR_TOOL_TEMP, dan salah satu
 * cacatnya — riwayat mencatat setiap keputusan sebagai persetujuan — tidak akan
 * pernah ketahuan tanpa membaca procedure-nya satu per satu.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalNamaReferensi = exports.KUNCI_REFERENSI_LAMA = exports.KOLOM_ALAT = void 0;
exports.bakukanIsiLama = bakukanIsiLama;
exports.saringIsi = saringIsi;
exports.validasiUsulan = validasiUsulan;
exports.bolehMengusulkan = bolehMengusulkan;
exports.periksaKeputusan = periksaKeputusan;
exports.statusRiwayat = statusRiwayat;
exports.susunPerubahan = susunPerubahan;
/**
 * Bidang yang boleh diubah lewat usulan, dipetakan ke kolom tabel `alat`.
 *
 * Daftar ini sekaligus pagar keamanan: nama kolom tidak dapat diikat sebagai
 * parameter SQL, jadi hanya kolom yang tertulis di sini yang pernah masuk ke
 * pernyataan UPDATE. Bidang lain di isi usulan diabaikan, bukan diteruskan.
 */
exports.KOLOM_ALAT = {
    nama: 'nama',
    namaPanggilan: 'nama_panggilan',
    kodeBarcode: 'kode_barcode',
    spesifikasi: 'spesifikasi',
    fungsi: 'fungsi',
    jenisId: 'jenis_id',
    kondisiId: 'kondisi_id',
    lokasiId: 'lokasi_id',
    persenKondisi: 'persen_kondisi',
    unitId: 'unit_id',
    bidangId: 'bidang_id',
    kodeMaximo: 'kode_maximo',
    nomorAset: 'nomor_aset',
    tahunPerolehan: 'tahun_perolehan',
    nilaiKontrak: 'nilai_kontrak',
    masaManfaat: 'masa_manfaat',
    estimasiPertahun: 'estimasi_pertahun',
    estimasiPersurat: 'estimasi_persurat',
};
/** Kunci isi usulan sistem lama yang berisi nama referensi, bukan id-nya. */
exports.KUNCI_REFERENSI_LAMA = {
    jenis: 'jenisId',
    kondisi: 'kondisiId',
    lokasi: 'lokasiId',
};
/** Pembanding nama referensi: huruf besar-kecil dan spasi berlebih diabaikan. */
const normalNamaReferensi = (nama) => nama.trim().replace(/\s+/g, ' ').toLowerCase();
exports.normalNamaReferensi = normalNamaReferensi;
/**
 * Membakukan isi usulan warisan sistem lama ke bentuk KOLOM_ALAT.
 *
 * Usulan lama menyimpan `namaAlat` dan nama jenis/kondisi/lokasi. Tanpa
 * pembakuan, saringIsi membuang kunci-kunci itu dan persetujuan tercatat
 * berhasil padahal alatnya tidak berubah. Nama yang tidak ditemukan
 * dilaporkan di `takTerpetakan` supaya pemanggil dapat menolak menerapkannya.
 */
function bakukanIsiLama(mentah, cariId) {
    const salinan = { ...mentah };
    const takTerpetakan = [];
    if (salinan.nama === undefined && typeof salinan.namaAlat === 'string') {
        salinan.nama = salinan.namaAlat.trim();
    }
    for (const [lama, baru] of Object.entries(exports.KUNCI_REFERENSI_LAMA)) {
        const nilai = salinan[lama];
        if (salinan[baru] !== undefined || typeof nilai !== 'string' || !nilai.trim())
            continue;
        const id = cariId(baru, nilai);
        if (id === undefined)
            takTerpetakan.push(`${lama} "${nilai.trim()}"`);
        else
            salinan[baru] = id;
    }
    return { isi: saringIsi(salinan), takTerpetakan };
}
/** Hanya bidang yang dikenal yang dibawa; sisanya dibuang. */
function saringIsi(masukan) {
    const hasil = {};
    for (const [kunci, nilai] of Object.entries(masukan)) {
        if (!(kunci in exports.KOLOM_ALAT))
            continue;
        if (nilai === undefined)
            continue;
        if (nilai !== null && typeof nilai !== 'string' && typeof nilai !== 'number')
            continue;
        hasil[kunci] = nilai;
    }
    return hasil;
}
function validasiUsulan(tindakan, isi) {
    const salah = [];
    if (tindakan === 'UBAH' && Object.keys(isi).length === 0) {
        salah.push({ field: 'isi', message: 'Usulan ubah harus memuat setidaknya satu perubahan' });
    }
    if ('nama' in isi && !String(isi.nama ?? '').trim()) {
        salah.push({ field: 'nama', message: 'Nama alat tidak boleh dikosongkan' });
    }
    for (const angka of ['tahunPerolehan', 'nilaiKontrak', 'masaManfaat', 'estimasiPertahun', 'estimasiPersurat']) {
        const nilai = isi[angka];
        if (nilai === undefined || nilai === null || nilai === '')
            continue;
        const n = Number(nilai);
        if (!Number.isFinite(n) || n < 0) {
            salah.push({ field: angka, message: `${angka} harus berupa angka tidak negatif` });
        }
    }
    const tahun = isi.tahunPerolehan;
    if (tahun !== undefined && tahun !== null && tahun !== '') {
        const t = Number(tahun);
        if (Number.isFinite(t) && (t < 1950 || t > new Date().getFullYear() + 1)) {
            salah.push({ field: 'tahunPerolehan', message: 'Tahun perolehan tidak masuk akal' });
        }
    }
    return salah;
}
/**
 * Satu alat hanya boleh punya satu usulan menunggu pada satu waktu.
 *
 * Dibawa apa adanya dari sistem lama: dua usulan yang sama-sama menunggu akan
 * saling menimpa bila keduanya disetujui, dan pemutus tidak akan tahu mana yang
 * ia setujui lebih dulu.
 */
function bolehMengusulkan(jumlahMenunggu) {
    if (jumlahMenunggu > 0) {
        return {
            field: 'alat',
            message: 'Alat ini masih punya usulan yang menunggu keputusan',
        };
    }
    return null;
}
/**
 * Memeriksa keputusan atas usulan.
 *
 * Tiga hal yang di sistem lama tidak diperiksa sama sekali: siapa pemutusnya,
 * apakah usulannya masih menunggu, dan apakah penolakan beralasan.
 */
function periksaKeputusan(masukan) {
    if (!masukan.adalahPemutusSah) {
        return { boleh: false, alasan: 'Usulan perubahan alat hanya dapat diputuskan admin super' };
    }
    if (masukan.statusSaatIni !== 'WAITING APPROVAL') {
        return { boleh: false, alasan: `Usulan ini sudah diputuskan (${masukan.statusSaatIni})` };
    }
    if (masukan.keputusan === 'TOLAK' && !masukan.alasan?.trim()) {
        return { boleh: false, alasan: 'Penolakan usulan wajib disertai alasan' };
    }
    return { boleh: true };
}
/**
 * Status yang dicatat di riwayat untuk sebuah keputusan.
 *
 * Tampak remeh, dan justru karena itu dituliskan sebagai fungsi yang diuji:
 * procedure lama menulis 'APPROVE' ke riwayat tanpa melihat keputusannya,
 * sehingga 35 penolakan tercatat sebagai persetujuan.
 */
function statusRiwayat(keputusan) {
    return keputusan === 'SETUJU' ? 'APPROVE' : 'REJECT';
}
/** Menyusun bagian SET untuk UPDATE, hanya dari kolom yang terdaftar. */
function susunPerubahan(isi) {
    const bagian = [];
    const ikatan = {};
    for (const [bidang, nilai] of Object.entries(isi)) {
        const kolom = exports.KOLOM_ALAT[bidang];
        if (!kolom)
            continue;
        bagian.push(`${kolom} = :${bidang}`);
        ikatan[bidang] = nilai === '' ? null : nilai;
    }
    return { set: bagian.join(', '), ikatan };
}
//# sourceMappingURL=usulan.js.map