"use strict";
/**
 * Aturan kuesioner kepuasan (docs/aturan-bisnis/kuesioner.md).
 *
 * Fungsi murni. Procedure lama menghitung jumlah BARIS jawaban untuk menentukan
 * sesi lengkap, sehingga menjawab satu pertanyaan dua kali bisa membuat sesi
 * tampak lengkap padahal ada pertanyaan yang tidak pernah dijawab. Di sini yang
 * dihitung adalah pertanyaan yang terjawab.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.bentukPertanyaan = bentukPertanyaan;
exports.validasiJawaban = validasiJawaban;
exports.sesiLengkap = sesiLengkap;
exports.rekapIpa = rekapIpa;
/** Kritik dan saran dijawab dengan teks; sisanya dengan dua nilai skala. */
function bentukPertanyaan(p) {
    const kategori = (p.kategori ?? '').trim().toUpperCase();
    return kategori === 'KRITIK' || kategori === 'SARAN' ? 'TEKS' : 'SKALA';
}
function skalaSah(nilai) {
    const n = Number(nilai);
    return Number.isInteger(n) && n >= 1 && n <= 5;
}
function validasiJawaban(pertanyaan, jawaban) {
    const salah = [];
    const peta = new Map(pertanyaan.map((p) => [p.id, p]));
    const terlihat = new Set();
    for (const j of jawaban) {
        const p = peta.get(j.pertanyaanId);
        if (!p) {
            salah.push({ field: `jawaban.${j.pertanyaanId}`, message: 'Pertanyaan tidak dikenali' });
            continue;
        }
        if (terlihat.has(j.pertanyaanId)) {
            // Inilah celah procedure lama: satu pertanyaan dijawab dua kali dihitung
            // sebagai dua jawaban.
            salah.push({ field: `jawaban.${j.pertanyaanId}`, message: 'Pertanyaan dijawab lebih dari sekali' });
            continue;
        }
        terlihat.add(j.pertanyaanId);
        if (bentukPertanyaan(p) === 'SKALA') {
            if (!skalaSah(j.kepentingan)) {
                salah.push({ field: `jawaban.${p.id}.kepentingan`, message: 'Nilai kepentingan harus 1 sampai 5' });
            }
            if (!skalaSah(j.kinerja)) {
                salah.push({ field: `jawaban.${p.id}.kinerja`, message: 'Nilai kinerja harus 1 sampai 5' });
            }
        }
        else if (!j.teks?.trim()) {
            salah.push({ field: `jawaban.${p.id}.teks`, message: `${p.kategori ?? 'Isian'} wajib diisi` });
        }
    }
    return salah;
}
/**
 * Sesi dianggap lengkap bila SETIAP pertanyaan aktif sudah terjawab.
 *
 * Dihitung per pertanyaan, bukan per baris, sehingga jawaban ganda tidak dapat
 * menutupi pertanyaan yang terlewat.
 */
function sesiLengkap(pertanyaanAktif, terjawab) {
    const sudah = new Set(terjawab);
    return pertanyaanAktif.length > 0 && pertanyaanAktif.every((id) => sudah.has(id));
}
/**
 * Rekap Importance-Performance per pertanyaan.
 *
 * Kuadran ditentukan terhadap rata-rata keseluruhan, cara baku dalam analisis
 * ini: penting dan kinerja rendah berarti perlu diperbaiki lebih dulu.
 */
function rekapIpa(baris) {
    const perPertanyaan = new Map();
    for (const b of baris) {
        const kelompok = perPertanyaan.get(b.pertanyaanId) ?? [];
        kelompok.push(b);
        perPertanyaan.set(b.pertanyaanId, kelompok);
    }
    const bulat = (n) => Math.round(n * 100) / 100;
    const rata = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const sementara = [...perPertanyaan.entries()].map(([id, isi]) => ({
        pertanyaanId: id,
        rataKepentingan: rata(isi.map((x) => x.kepentingan)),
        rataKinerja: rata(isi.map((x) => x.kinerja)),
        jumlahResponden: isi.length,
    }));
    const acuanPenting = rata(sementara.map((s) => s.rataKepentingan));
    const acuanKinerja = rata(sementara.map((s) => s.rataKinerja));
    return sementara
        .map((s) => {
        const penting = s.rataKepentingan >= acuanPenting;
        const baik = s.rataKinerja >= acuanKinerja;
        const prioritas = penting && !baik ? 'PERBAIKI' : penting && baik ? 'PERTAHANKAN' : !penting && baik ? 'BERLEBIH' : 'RENDAH';
        return {
            pertanyaanId: s.pertanyaanId,
            rataKepentingan: bulat(s.rataKepentingan),
            rataKinerja: bulat(s.rataKinerja),
            selisih: bulat(s.rataKepentingan - s.rataKinerja),
            jumlahResponden: s.jumlahResponden,
            prioritas,
        };
    })
        .sort((a, b) => b.selisih - a.selisih);
}
//# sourceMappingURL=kuesioner.js.map