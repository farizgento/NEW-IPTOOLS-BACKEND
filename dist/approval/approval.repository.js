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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalRepository = void 0;
const common_1 = require("@nestjs/common");
const oracle_service_1 = require("../basisdata/oracle.service");
/**
 * Antrean tugas (PRD F4).
 *
 * Menggantikan tiga halaman terpisah — pengecekan, review supervisor, review
 * manajer — dengan satu kueri. Yang membedakan isi antrean tiap orang hanya
 * peran dan unitnya, bukan halaman yang ia buka.
 *
 * Lingkup unit mengikuti SK: yang menyetujui adalah penanggung jawab alat di
 * unit pemilik alat, bukan unit peminjam.
 */
const ANTREAN = `
  SELECT pm.id                AS peminjaman_id,
         pm.pekerjaan         AS pekerjaan,
         pm.nama_peminjam_historis AS peminjam,
         u.nama               AS unit,
         r.nama               AS jenis_alur,
         TO_CHAR(pm.tanggal_mulai,'YYYY-MM-DD') AS tanggal_mulai,
         TO_CHAR(pm.tanggal_selesai,'YYYY-MM-DD') AS tanggal_selesai,
         pm.status            AS status,
         ap.tahap             AS tahap,
         -- Sejak kapan tahap ini menunggu: sejak tahap sebelumnya diputuskan,
         -- atau sejak pengajuan dibuat bila ini tahap pertama.
         --
         -- Bukan ap.dibuat_pada: baris approval untuk pengajuan lama dibuat
         -- saat migrasi, sehingga seluruh antrean akan tampak berumur nol hari
         -- padahal ada yang sudah menunggu bertahun-tahun.
         NVL((SELECT MAX(sebelum.diputuskan_pada)
                FROM peminjaman_approval sebelum
               WHERE sebelum.peminjaman_id = ap.peminjaman_id
                 AND sebelum.urutan < ap.urutan),
             pm.dibuat_pada)  AS menunggu_sejak,
         (SELECT COUNT(*) FROM peminjaman_alat pa WHERE pa.peminjaman_id = pm.id) AS jumlah_alat
    FROM peminjaman_approval ap
    JOIN peminjaman pm    ON pm.id = ap.peminjaman_id
    LEFT JOIN unit u      ON u.id  = pm.unit_id
    LEFT JOIN referensi r ON r.id  = pm.jenis_alur_id
   WHERE ap.keputusan = 'MENUNGGU'
     AND ap.tahap IN (SELECT COLUMN_VALUE FROM TABLE(:tahapList))
     AND UPPER(pm.status) NOT IN ('REJECT','REJECT PERPANJANGAN','FINISH','PARTIAL FINISH')
     -- Tahap yang lebih awal harus sudah diputuskan lebih dulu.
     AND NOT EXISTS (SELECT 1 FROM peminjaman_approval sebelum
                      WHERE sebelum.peminjaman_id = ap.peminjaman_id
                        AND sebelum.urutan < ap.urutan
                        AND sebelum.keputusan = 'MENUNGGU')
     -- Hanya alat yang menjadi tanggung jawab unit pengguna.
     AND EXISTS (SELECT 1 FROM peminjaman_alat pa
                   JOIN alat a ON a.id = pa.alat_id
                  WHERE pa.peminjaman_id = pm.id
                    AND a.unit_id = :unitId)
   ORDER BY menunggu_sejak, pm.id
`;
let ApprovalRepository = class ApprovalRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async antrean(tahapList, unitId) {
        if (!tahapList.length || !unitId)
            return [];
        // Daftar tahap diikat sebagai larik, bukan dirangkai ke teks SQL.
        const baris = await this.db.kueri(ANTREAN, {
            tahapList: {
                type: 'SYS.ODCIVARCHAR2LIST',
                val: tahapList,
            },
            unitId,
        });
        const sekarang = Date.now();
        return baris.map((r) => {
            const sejak = r.MENUNGGU_SEJAK ? new Date(String(r.MENUNGGU_SEJAK)) : null;
            return {
                peminjamanId: Number(r.PEMINJAMAN_ID),
                pekerjaan: r.PEKERJAAN ?? null,
                peminjam: r.PEMINJAM ?? null,
                unit: r.UNIT ?? null,
                jenisAlur: r.JENIS_ALUR ?? null,
                tanggalMulai: r.TANGGAL_MULAI ?? null,
                tanggalSelesai: r.TANGGAL_SELESAI ?? null,
                jumlahAlat: Number(r.JUMLAH_ALAT ?? 0),
                tahap: r.TAHAP,
                status: r.STATUS,
                menungguSejak: sejak ? sejak.toISOString() : null,
                umurHari: sejak ? Math.floor((sekarang - sejak.getTime()) / 86_400_000) : 0,
            };
        });
    }
    async rantai(peminjamanId) {
        const baris = await this.db.kueri(`SELECT urutan, tahap, keputusan FROM peminjaman_approval
        WHERE peminjaman_id = :peminjamanId ORDER BY urutan`, { peminjamanId });
        return baris.map((r) => ({
            urutan: Number(r.URUTAN),
            tahap: r.TAHAP,
            keputusan: r.KEPUTUSAN,
        }));
    }
    /** Isi layar keputusan: identitas pengajuan, daftar alat, riwayat approval. */
    async berkas(peminjamanId) {
        const pengajuan = await this.db.kueriSatu(`
      SELECT pm.id, pm.pekerjaan, pm.status, pm.nomor_wo,
             TO_CHAR(pm.tanggal_mulai,'YYYY-MM-DD')   AS tanggal_mulai,
             TO_CHAR(pm.tanggal_selesai,'YYYY-MM-DD') AS tanggal_selesai,
             pm.tujuan, pm.kontak,
             pm.nama_peminjam_historis AS peminjam,
             u.nama AS unit, r.nama AS jenis_alur
        FROM peminjaman pm
        LEFT JOIN unit u      ON u.id = pm.unit_id
        LEFT JOIN referensi r ON r.id = pm.jenis_alur_id
       WHERE pm.id = :peminjamanId
      `, { peminjamanId });
        const alat = await this.db.kueri(`
      SELECT pa.id, a.nama, a.kode_barcode, pa.status,
             ru.nama AS unit, rk.nama AS kondisi, rl.nama AS lokasi
        FROM peminjaman_alat pa
        LEFT JOIN alat a       ON a.id  = pa.alat_id
        LEFT JOIN unit ru      ON ru.id = a.unit_id
        LEFT JOIN referensi rk ON rk.id = a.kondisi_id
        LEFT JOIN referensi rl ON rl.id = a.lokasi_id
       WHERE pa.peminjaman_id = :peminjamanId
       ORDER BY pa.id
      `, { peminjamanId });
        const approval = await this.db.kueri(`
      SELECT ap.urutan, ap.tahap, ap.keputusan, ap.alasan,
             NVL(p.nama, ap.nama_penyetuju_historis) AS penyetuju,
             TO_CHAR(ap.diputuskan_pada,'YYYY-MM-DD HH24:MI') AS diputuskan_pada,
             ap.disusun_ulang
        FROM peminjaman_approval ap
        LEFT JOIN pengguna p ON p.id = ap.penyetuju_id
       WHERE ap.peminjaman_id = :peminjamanId
       ORDER BY ap.urutan
      `, { peminjamanId });
        return { pengajuan, alat, approval };
    }
    /**
     * Menyimpan keputusan: baris approval, status pengajuan, dan riwayatnya —
     * seluruhnya dalam satu transaksi.
     */
    async simpanKeputusan(masukan) {
        await this.db.transaksi(async (koneksi) => {
            const hasil = await koneksi.execute(`
        UPDATE peminjaman_approval
           SET keputusan = :keputusan,
               alasan = :alasan,
               penyetuju_id = :penyetujuId,
               nama_penyetuju_historis = :namaPenyetuju,
               diputuskan_pada = SYSTIMESTAMP
         WHERE peminjaman_id = :peminjamanId
           AND urutan = :urutan
           AND keputusan = 'MENUNGGU'
        `, {
                keputusan: masukan.keputusan,
                alasan: masukan.alasan,
                penyetujuId: masukan.penyetujuId,
                namaPenyetuju: masukan.namaPenyetuju,
                peminjamanId: masukan.peminjamanId,
                urutan: masukan.urutan,
            });
            // Syarat keputusan = 'MENUNGGU' di atas menutup balapan: bila dua orang
            // menekan tombol bersamaan, hanya satu yang mengubah baris.
            if (!hasil.rowsAffected) {
                throw new Error('Tahap ini sudah diputuskan orang lain');
            }
            await koneksi.execute(`UPDATE peminjaman SET status = :statusBaru, diubah_pada = SYSTIMESTAMP
          WHERE id = :peminjamanId`, { statusBaru: masukan.statusBaru, peminjamanId: masukan.peminjamanId });
            await koneksi.execute(`
        INSERT INTO peminjaman_riwayat (
          peminjaman_id, status_lama, status_baru, keterangan, oleh, nama_historis, dibuat_pada)
        VALUES (:peminjamanId, :statusLama, :statusBaru, :keterangan, :oleh, :nama, SYSTIMESTAMP)
        `, {
                peminjamanId: masukan.peminjamanId,
                statusLama: masukan.statusLama,
                statusBaru: masukan.statusBaru,
                keterangan: masukan.keterangan,
                oleh: masukan.penyetujuId,
                nama: masukan.namaPenyetuju,
            });
        });
    }
};
exports.ApprovalRepository = ApprovalRepository;
exports.ApprovalRepository = ApprovalRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [oracle_service_1.OracleService])
], ApprovalRepository);
//# sourceMappingURL=approval.repository.js.map