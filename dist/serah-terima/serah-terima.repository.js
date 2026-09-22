"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SerahTerimaRepository = void 0;
const common_1 = require("@nestjs/common");
const oracledb_1 = __importDefault(require("oracledb"));
const oracle_service_1 = require("../basisdata/oracle.service");
const lampiran_repository_1 = require("../lampiran/lampiran.repository");
let SerahTerimaRepository = class SerahTerimaRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    PILIH = `
    SELECT st.id, st.peminjaman_id, st.arah, st.bentuk, st.status,
           st.diserahkan_pada, pm.pekerjaan, pm.peminjam_id,
           pm.nama_peminjam_historis AS peminjam,
           (SELECT COUNT(*) FROM serah_terima_alat x WHERE x.serah_terima_id = st.id) AS jumlah_alat,
           (SELECT COUNT(*) FROM serah_terima_alat x
             WHERE x.serah_terima_id = st.id AND x.dikonfirmasi_pada IS NULL) AS belum
      FROM serah_terima st
      JOIN peminjaman pm ON pm.id = st.peminjaman_id
  `;
    keRingkasan(r) {
        const diserahkan = r.DISERAHKAN_PADA ? new Date(String(r.DISERAHKAN_PADA)) : null;
        return {
            id: Number(r.ID),
            peminjamanId: Number(r.PEMINJAMAN_ID),
            arah: r.ARAH,
            bentuk: r.BENTUK,
            status: r.STATUS,
            pekerjaan: r.PEKERJAAN ?? null,
            peminjamId: r.PEMINJAM_ID === null ? null : Number(r.PEMINJAM_ID),
            peminjam: r.PEMINJAM ?? null,
            jumlahAlat: Number(r.JUMLAH_ALAT ?? 0),
            belumDikonfirmasi: Number(r.BELUM ?? 0),
            diserahkanPada: diserahkan ? diserahkan.toISOString() : null,
            umurHari: diserahkan
                ? Math.floor((Date.now() - diserahkan.getTime()) / 86_400_000)
                : 0,
        };
    }
    /** Serah terima yang menunggu konfirmasi peminjam ini (PRD F9). */
    async menungguKonfirmasi(peminjamId) {
        const baris = await this.db.kueri(`${this.PILIH}
        WHERE pm.peminjam_id = :peminjamId
          AND st.status IN ('SENT','RETURN')
          AND EXISTS (SELECT 1 FROM serah_terima_alat x
                       WHERE x.serah_terima_id = st.id AND x.dikonfirmasi_pada IS NULL)
        ORDER BY st.diserahkan_pada`, { peminjamId });
        return baris.map((r) => this.keRingkasan(r));
    }
    /**
     * Daftar kerja petugas gudang (PRD F7 + F12).
     *
     * Lingkupnya alat milik unit petugas, sama dengan lingkup approval: yang
     * menyerahkan adalah gudang pemilik alat, bukan unit peminjam.
     */
    async antreanPetugas(unitId) {
        const siap = await this.db.kueri(`
      SELECT pm.id, pm.pekerjaan, pm.status, pm.nama_peminjam_historis AS peminjam,
             up.nama AS unit_peminjam, r.kode AS alur,
             TO_CHAR(pm.tanggal_mulai,'YYYY-MM-DD') AS tanggal_mulai,
             TO_CHAR(pm.tanggal_selesai,'YYYY-MM-DD') AS tanggal_selesai,
             COUNT(pa.id) AS jumlah_alat
        FROM peminjaman pm
        JOIN peminjaman_alat pa ON pa.peminjaman_id = pm.id
        JOIN alat a             ON a.id = pa.alat_id
        LEFT JOIN unit up       ON up.id = pm.unit_id
        LEFT JOIN referensi r   ON r.id = pm.jenis_alur_id
       WHERE pm.status IN ('APPROVED','PARTIAL SENT')
         AND a.unit_id = :unitId
         AND NOT EXISTS (SELECT 1 FROM serah_terima_alat x JOIN serah_terima s ON s.id = x.serah_terima_id
                          WHERE x.peminjaman_alat_id = pa.id AND s.arah = 'KIRIM')
       GROUP BY pm.id, pm.pekerjaan, pm.status, pm.nama_peminjam_historis, up.nama, r.kode,
                pm.tanggal_mulai, pm.tanggal_selesai
       ORDER BY pm.tanggal_mulai DESC, pm.id DESC
      `, { unitId });
        const menunggu = await this.db.kueri(`${this.PILIH}
        WHERE st.status IN ('SENT','RETURN')
          AND EXISTS (SELECT 1 FROM serah_terima_alat x WHERE x.serah_terima_id = st.id AND x.dikonfirmasi_pada IS NULL)
          -- Hanya pengajuan yang memang masih menunggu konfirmasi. Data lama
          -- menyimpan ratusan serah terima tanpa tanda konfirmasi pada
          -- pengajuan yang sudah lama selesai.
          AND pm.status IN ('SENT','PARTIAL SENT','PARTIAL RECEIVED','RETURN','PARTIAL RETURN')
          AND EXISTS (SELECT 1 FROM serah_terima_alat x JOIN alat a ON a.id = x.alat_id
                       WHERE x.serah_terima_id = st.id AND a.unit_id = :unitId)
        ORDER BY st.diserahkan_pada
        FETCH FIRST 200 ROWS ONLY`, { unitId });
        const draf = await this.db.kueri(`${this.PILIH}
        WHERE st.status = 'DRAFT'
          AND EXISTS (SELECT 1 FROM serah_terima_alat x JOIN alat a ON a.id = x.alat_id
                       WHERE x.serah_terima_id = st.id AND a.unit_id = :unitId)
        ORDER BY st.dibuat_pada DESC`, { unitId });
        return {
            siap: siap.map((r) => ({
                peminjamanId: Number(r.ID),
                pekerjaan: r.PEKERJAAN ?? null,
                status: r.STATUS,
                peminjam: r.PEMINJAM ?? null,
                unitPeminjam: r.UNIT_PEMINJAM ?? null,
                alur: r.ALUR ?? null,
                tanggalMulai: r.TANGGAL_MULAI ?? null,
                tanggalSelesai: r.TANGGAL_SELESAI ?? null,
                jumlahAlat: Number(r.JUMLAH_ALAT ?? 0),
            })),
            draf: draf.map((r) => this.keRingkasan(r)),
            menunggu: menunggu.map((r) => this.keRingkasan(r)),
        };
    }
    /** Bahan layar penyiapan: pengajuan, alat yang belum diserahkan, dan daftar kelengkapannya. */
    async persiapan(peminjamanId, unitId) {
        const pengajuan = await this.db.kueriSatu(`
      SELECT pm.id, pm.pekerjaan, pm.status, pm.nomor_wo, pm.tujuan, pm.kontak,
             pm.peminjam_id, pm.nama_peminjam_historis AS peminjam, up.nama AS unit_peminjam,
             r.kode AS alur,
             TO_CHAR(pm.tanggal_mulai,'YYYY-MM-DD') AS tanggal_mulai,
             TO_CHAR(pm.tanggal_selesai,'YYYY-MM-DD') AS tanggal_selesai
        FROM peminjaman pm
        LEFT JOIN unit up     ON up.id = pm.unit_id
        LEFT JOIN referensi r ON r.id = pm.jenis_alur_id
       WHERE pm.id = :peminjamanId
      `, { peminjamanId });
        if (!pengajuan)
            return undefined;
        const alat = await this.db.kueri(`
      SELECT pa.id AS peminjaman_alat_id, a.id AS alat_id, a.nama, a.nama_panggilan, a.kode_barcode,
             rl.nama AS lokasi, rk.nama AS kondisi, ${(0, lampiran_repository_1.sqlFotoUtama)('a.id')} AS foto_id
        FROM peminjaman_alat pa
        JOIN alat a            ON a.id = pa.alat_id
        LEFT JOIN referensi rl ON rl.id = a.lokasi_id
        LEFT JOIN referensi rk ON rk.id = a.kondisi_id
       WHERE pa.peminjaman_id = :peminjamanId
         AND a.unit_id = :unitId
         AND NOT EXISTS (SELECT 1 FROM serah_terima_alat x JOIN serah_terima s ON s.id = x.serah_terima_id
                          WHERE x.peminjaman_alat_id = pa.id AND s.arah = 'KIRIM')
       ORDER BY pa.id
      `, { peminjamanId, unitId });
        const aksesoris = [];
        for (const a of alat) {
            const isi = await this.db.kueri('SELECT nama, jumlah, satuan FROM alat_aksesoris WHERE alat_id = :alatId ORDER BY id', { alatId: Number(a.ALAT_ID) });
            for (const x of isi)
                aksesoris.push({ ...x, ALAT_ID: a.ALAT_ID });
        }
        return {
            pengajuan: {
                id: Number(pengajuan.ID),
                pekerjaan: pengajuan.PEKERJAAN ?? null,
                status: pengajuan.STATUS,
                nomorWo: pengajuan.NOMOR_WO ?? null,
                tujuan: pengajuan.TUJUAN ?? null,
                kontak: pengajuan.KONTAK ?? null,
                peminjamId: pengajuan.PEMINJAM_ID === null ? null : Number(pengajuan.PEMINJAM_ID),
                peminjam: pengajuan.PEMINJAM ?? null,
                unitPeminjam: pengajuan.UNIT_PEMINJAM ?? null,
                alur: pengajuan.ALUR ?? null,
                tanggalMulai: pengajuan.TANGGAL_MULAI ?? null,
                tanggalSelesai: pengajuan.TANGGAL_SELESAI ?? null,
            },
            alat: alat.map((a) => ({
                peminjamanAlatId: Number(a.PEMINJAMAN_ALAT_ID),
                alatId: Number(a.ALAT_ID),
                fotoId: a.FOTO_ID == null ? null : Number(a.FOTO_ID),
                nama: (a.NAMA_PANGGILAN || a.NAMA || '').trim(),
                kodeBarcode: a.KODE_BARCODE ?? null,
                lokasi: a.LOKASI ?? null,
                kondisi: a.KONDISI ?? null,
                aksesoris: aksesoris
                    .filter((x) => Number(x.ALAT_ID) === Number(a.ALAT_ID))
                    .map((x) => ({
                    nama: String(x.NAMA ?? '').trim(),
                    jumlah: x.JUMLAH === null ? null : Number(x.JUMLAH),
                    satuan: x.SATUAN ?? null,
                })),
            })),
        };
    }
    /**
     * Alat yang penilaian kondisinya lengkap (kelima grup) pada satu tahap.
     * Dipakai sebagai syarat sebelum alat masuk dokumen serah terima.
     */
    async alatDinilai(peminjamanAlatIds, tahap, jumlahGrup) {
        if (!peminjamanAlatIds.length)
            return new Set();
        const ikatan = { tahap, jumlahGrup };
        peminjamanAlatIds.forEach((id, i) => (ikatan['p' + i] = id));
        const baris = await this.db.kueri(`SELECT pk.peminjaman_alat_id
         FROM penilaian_kondisi pk
         JOIN kategori_kondisi kk ON kk.id = pk.kategori_id
        WHERE pk.tahap = :tahap
          AND pk.peminjaman_alat_id IN (${peminjamanAlatIds.map((_, i) => ':p' + i).join(',')})
        GROUP BY pk.peminjaman_alat_id
       HAVING COUNT(DISTINCT kk.grup) >= :jumlahGrup`, ikatan);
        return new Set(baris.map((b) => Number(b.PEMINJAMAN_ALAT_ID)));
    }
    async ambil(id) {
        const baris = await this.db.kueriSatu(`${this.PILIH} WHERE st.id = :id`, { id });
        return baris ? this.keRingkasan(baris) : undefined;
    }
    /**
     * Daftar alat pada satu serah terima, lengkap dengan kode barcodenya.
     *
     * Kode barcode diambil dari basis data dan ditampilkan agar peminjam dapat
     * mencocokkannya dengan label fisik. Di sistem lama ini tidak mungkin: tabel
     * surat jalan tidak menyimpan alat maupun kodenya (PRD 6.0 nomor 7).
     */
    async alat(serahTerimaId) {
        return this.db.kueri(`
      SELECT sta.id, sta.peminjaman_alat_id, sta.status,
             sta.metode_konfirmasi, sta.alasan_konfirmasi,
             TO_CHAR(sta.dikonfirmasi_pada,'YYYY-MM-DD HH24:MI') AS dikonfirmasi_pada,
             a.nama AS nama_alat, a.kode_barcode,
             rk.nama AS kondisi, u.nama AS unit
        FROM serah_terima_alat sta
        LEFT JOIN alat a       ON a.id  = sta.alat_id
        LEFT JOIN unit u       ON u.id  = a.unit_id
        LEFT JOIN referensi rk ON rk.id = a.kondisi_id
       WHERE sta.serah_terima_id = :serahTerimaId
       ORDER BY sta.id
      `, { serahTerimaId });
    }
    async kodeKonfirmasi(id) {
        const baris = await this.db.kueriSatu('SELECT kode_konfirmasi, percobaan_kode FROM serah_terima WHERE id = :id', { id });
        return {
            kode: baris?.KODE_KONFIRMASI ?? null,
            percobaan: Number(baris?.PERCOBAAN_KODE ?? 0),
        };
    }
    async catatPercobaanKode(id) {
        await this.db.transaksi(async (koneksi) => {
            await koneksi.execute('UPDATE serah_terima SET percobaan_kode = percobaan_kode + 1 WHERE id = :id', { id });
        });
    }
    /**
     * Menyiapkan serah terima beserta alatnya (PRD F7).
     *
     * Kode konfirmasi diterbitkan di sini agar sudah tercetak pada dokumen
     * sebelum alat berpindah tangan.
     */
    async siapkan(masukan) {
        return this.db.transaksi(async (koneksi) => {
            const urutan = await koneksi.execute('SELECT NVL(MAX(surat_ke),0) + 1 AS n FROM serah_terima WHERE peminjaman_id = :id', { id: masukan.peminjamanId });
            const hasil = await koneksi.execute(`
        INSERT INTO serah_terima (
          peminjaman_id, arah, bentuk, surat_ke, status, kode_konfirmasi,
          nomor_kendaraan, jenis_kendaraan, pengemudi, dibuat_oleh,
          nama_pembuat_historis)
        VALUES (:peminjamanId, :arah, :bentuk, :suratKe, 'DRAFT', :kode,
                :nomorKendaraan, :jenisKendaraan, :pengemudi, :dibuatOleh, :namaPembuat)
        RETURNING id INTO :id
        `, {
                peminjamanId: masukan.peminjamanId,
                arah: masukan.arah,
                bentuk: masukan.bentuk,
                suratKe: Number(urutan.rows?.[0]?.N ?? 1),
                kode: masukan.kodeKonfirmasi,
                nomorKendaraan: masukan.nomorKendaraan,
                jenisKendaraan: masukan.jenisKendaraan,
                pengemudi: masukan.pengemudi,
                dibuatOleh: masukan.dibuatOleh,
                namaPembuat: masukan.namaPembuat,
                id: { dir: oracledb_1.default.BIND_OUT, type: oracledb_1.default.NUMBER },
            });
            const serahTerimaId = Number(hasil.outBinds?.id?.[0]);
            for (const paId of masukan.peminjamanAlatIds) {
                await koneksi.execute(`
          INSERT INTO serah_terima_alat (serah_terima_id, peminjaman_alat_id, alat_id, status)
          SELECT :serahTerimaId, pa.id, pa.alat_id, 'DRAFT'
            FROM peminjaman_alat pa
           WHERE pa.id = :paId AND pa.peminjaman_id = :peminjamanId
          `, { serahTerimaId, paId, peminjamanId: masukan.peminjamanId });
                await koneksi.execute(`UPDATE peminjaman_alat SET status = 'MASUK_SERAH_TERIMA' WHERE id = :paId`, { paId });
            }
            return serahTerimaId;
        });
    }
    /**
     * Menyerahkan alat (PRD F7).
     *
     * Status pengajuan dihitung di dalam transaksi dari jumlah alat pengajuan yang
     * sudah diserahkan: seluruhnya SENT, sebagian PARTIAL SENT.
     */
    async serahkan(masukan) {
        return this.db.transaksi(async (koneksi) => {
            const lama = await koneksi.execute('SELECT status FROM peminjaman WHERE id = :pmId FOR UPDATE', { pmId: masukan.peminjamanId }, { outFormat: oracledb_1.default.OUT_FORMAT_OBJECT });
            const statusLama = lama.rows?.[0]?.STATUS ?? null;
            const statusAlat = masukan.arah === 'KIRIM' ? 'SENT' : 'RETURN';
            const ubah = await koneksi.execute(`UPDATE serah_terima SET status = :status, diserahkan_pada = SYSTIMESTAMP
          WHERE id = :id AND status = 'DRAFT'`, { status: statusAlat, id: masukan.serahTerimaId });
            if (!ubah.rowsAffected)
                throw new Error(`Serah terima #${masukan.serahTerimaId} tidak lagi berstatus DRAFT`);
            await koneksi.execute(`UPDATE serah_terima_alat SET status = :status WHERE serah_terima_id = :id`, { status: statusAlat, id: masukan.serahTerimaId });
            await koneksi.execute(masukan.arah === 'KIRIM'
                ? `UPDATE peminjaman_alat SET status = 'DIKIRIM', tanggal_kirim = SYSTIMESTAMP
              WHERE id IN (SELECT peminjaman_alat_id FROM serah_terima_alat WHERE serah_terima_id = :id)`
                : `UPDATE peminjaman_alat SET status = 'DIKEMBALIKAN'
              WHERE id IN (SELECT peminjaman_alat_id FROM serah_terima_alat WHERE serah_terima_id = :id)`, { id: masukan.serahTerimaId });
            const hitung = await koneksi.execute(`
        SELECT COUNT(*) AS jumlah,
               SUM(CASE WHEN EXISTS (
                 SELECT 1 FROM serah_terima_alat x JOIN serah_terima s ON s.id = x.serah_terima_id
                  WHERE x.peminjaman_alat_id = pa.id AND s.arah = :arah AND s.status <> 'DRAFT'
               ) THEN 1 ELSE 0 END) AS sudah
          FROM peminjaman_alat pa WHERE pa.peminjaman_id = :pmId
        `, { pmId: masukan.peminjamanId, arah: masukan.arah }, { outFormat: oracledb_1.default.OUT_FORMAT_OBJECT });
            const statusBaru = masukan.hitungStatus(Number(hitung.rows?.[0]?.JUMLAH ?? 0), Number(hitung.rows?.[0]?.SUDAH ?? 0));
            await koneksi.execute(`UPDATE peminjaman SET status = :status, diubah_pada = SYSTIMESTAMP WHERE id = :pmId`, { status: statusBaru, pmId: masukan.peminjamanId });
            await koneksi.execute(`
        INSERT INTO peminjaman_riwayat (
          peminjaman_id, status_lama, status_baru, keterangan, oleh, nama_historis, dibuat_pada)
        VALUES (:pmId, :statusLama, :statusBaru, :keterangan, :oleh, :nama, SYSTIMESTAMP)
        `, {
                pmId: masukan.peminjamanId,
                statusLama,
                statusBaru,
                keterangan: `Alat ${masukan.arah === 'KIRIM' ? 'diserahkan' : 'dikembalikan'} lewat serah terima #${masukan.serahTerimaId}`,
                oleh: masukan.oleh,
                nama: masukan.nama,
            });
            return statusBaru;
        });
    }
    /**
     * Mengonfirmasi sejumlah alat sekaligus, dalam SATU transaksi.
     *
     * Sistem lama memanggil prosedur penerimaan sekali per alat, dan prosedur itu
     * menghitung ulang jumlah alat yang sudah diterima lalu memutuskan status
     * pengajuan. Panggilan bersamaan bisa saling mendahului dan menghasilkan
     * status akhir yang salah (PRD F9). Di sini seluruh alat dan keputusan
     * statusnya berada dalam satu transaksi.
     */
    async konfirmasi(masukan) {
        return this.db.transaksi(async (koneksi) => {
            let dikonfirmasi = 0;
            for (const id of masukan.serahTerimaAlatIds) {
                const hasil = await koneksi.execute(`
          UPDATE serah_terima_alat
             SET metode_konfirmasi = :metode,
                 alasan_konfirmasi = :alasan,
                 dikonfirmasi_oleh = :oleh,
                 dikonfirmasi_pada = SYSTIMESTAMP,
                 status = 'DITERIMA'
           WHERE id = :id AND serah_terima_id = :stId AND dikonfirmasi_pada IS NULL
          `, {
                    metode: masukan.metode,
                    alasan: masukan.alasan,
                    oleh: masukan.oleh,
                    id,
                    stId: masukan.serahTerimaId,
                });
                if (hasil.rowsAffected) {
                    dikonfirmasi += 1;
                    await koneksi.execute(`UPDATE peminjaman_alat
                SET status = :statusAlat, tanggal_terima = SYSTIMESTAMP
              WHERE id = (SELECT peminjaman_alat_id FROM serah_terima_alat WHERE id = :id)`, {
                        statusAlat: masukan.arah === 'KIRIM' ? 'DITERIMA' : 'DIKEMBALIKAN',
                        id,
                    });
                }
            }
            for (const b of masukan.belumDiterima ?? []) {
                await koneksi.execute(`UPDATE serah_terima_alat
              SET status = 'BELUM_DITERIMA', alasan_konfirmasi = :alasan
            WHERE id = :id AND serah_terima_id = :stId AND dikonfirmasi_pada IS NULL`, { alasan: b.alasan, id: b.serahTerimaAlatId, stId: masukan.serahTerimaId });
            }
            const hitung = await koneksi.execute(`
        SELECT COUNT(*) AS jumlah,
               COUNT(dikonfirmasi_pada) AS sudah
          FROM serah_terima_alat WHERE serah_terima_id = :stId
        `, { stId: masukan.serahTerimaId }, { outFormat: oracledb_1.default.OUT_FORMAT_OBJECT });
            const jumlah = Number(hitung.rows?.[0]?.JUMLAH ?? 0);
            const sudah = Number(hitung.rows?.[0]?.SUDAH ?? 0);
            const status = masukan.hitungStatus(jumlah, sudah);
            await koneksi.execute(`UPDATE peminjaman SET status = :status, diubah_pada = SYSTIMESTAMP WHERE id = :pmId`, { status, pmId: masukan.peminjamanId });
            if (sudah >= jumlah) {
                await koneksi.execute(`UPDATE serah_terima SET status = 'SELESAI' WHERE id = :stId`, { stId: masukan.serahTerimaId });
            }
            await koneksi.execute(`
        INSERT INTO peminjaman_riwayat (
          peminjaman_id, status_lama, status_baru, keterangan, oleh, nama_historis, dibuat_pada)
        VALUES (:pmId, :statusLama, :status, :keterangan, :oleh, :nama, SYSTIMESTAMP)
        `, {
                pmId: masukan.peminjamanId,
                statusLama: masukan.statusLama,
                status,
                keterangan: `${dikonfirmasi} alat dikonfirmasi lewat ${masukan.metode}` +
                    (masukan.alasan ? ` — ${masukan.alasan}` : '') +
                    (masukan.belumDiterima?.length
                        ? `; ${masukan.belumDiterima.length} alat dinyatakan belum diterima`
                        : ''),
                oleh: masukan.oleh,
                nama: masukan.nama,
            });
            return { dikonfirmasi, sisa: jumlah - sudah, status };
        });
    }
};
exports.SerahTerimaRepository = SerahTerimaRepository;
exports.SerahTerimaRepository = SerahTerimaRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [oracle_service_1.OracleService])
], SerahTerimaRepository);
//# sourceMappingURL=serah-terima.repository.js.map