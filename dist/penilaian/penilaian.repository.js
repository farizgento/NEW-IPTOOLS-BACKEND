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
exports.PenilaianRepository = void 0;
const common_1 = require("@nestjs/common");
const oracle_service_1 = require("../basisdata/oracle.service");
let PenilaianRepository = class PenilaianRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async katalog() {
        const baris = await this.db.kueri('SELECT id, grup, keterangan, bobot, nilai FROM kategori_kondisi ORDER BY grup, nilai DESC');
        return baris.map((r) => ({
            id: Number(r.ID),
            grup: Number(r.GRUP),
            keterangan: r.KETERANGAN,
            bobot: Number(r.BOBOT),
            nilai: Number(r.NILAI),
        }));
    }
    /** Alat pada satu pengajuan beserta status penilaiannya di tahap tertentu. */
    async alatPengajuan(peminjamanId, tahap) {
        return this.db.kueri(`
      SELECT pa.id AS peminjaman_alat_id, a.nama AS nama_alat, a.kode_barcode,
             (SELECT COUNT(*) FROM penilaian_kondisi pk
               WHERE pk.peminjaman_alat_id = pa.id AND pk.tahap = :tahap) AS sudah_dinilai
        FROM peminjaman_alat pa
        LEFT JOIN alat a ON a.id = pa.alat_id
       WHERE pa.peminjaman_id = :peminjamanId
       ORDER BY pa.id
      `, { peminjamanId, tahap });
    }
    /**
     * Menyimpan penilaian sejumlah alat sekaligus, dalam SATU transaksi.
     *
     * Sistem lama memanggil prosedur pengisian sekali per alat per kategori —
     * untuk pengajuan 39 alat berarti 195 panggilan terpisah. Di sini satu
     * permintaan, satu transaksi (PRD F6).
     */
    async simpan(masukan) {
        return this.db.transaksi(async (koneksi) => {
            let baris = 0;
            for (const p of masukan.penilaian) {
                // Penilaian ulang pada tahap yang sama menggantikan yang sebelumnya,
                // bukan menumpuk — supaya perbaikan isian tidak menggandakan baris.
                await koneksi.execute(`DELETE FROM penilaian_kondisi
            WHERE peminjaman_alat_id = :paId AND tahap = :tahap AND id_lama IS NULL`, { paId: p.peminjamanAlatId, tahap: masukan.tahap });
                for (const pilihanId of p.pilihanIds) {
                    await koneksi.execute(`
            INSERT INTO penilaian_kondisi (
              peminjaman_alat_id, kategori_id, tahap, keterangan,
              dinilai_oleh, nama_penilai_historis)
            VALUES (:paId, :kategoriId, :tahap, :keterangan, :oleh, :nama)
            `, {
                        paId: p.peminjamanAlatId,
                        kategoriId: pilihanId,
                        tahap: masukan.tahap,
                        keterangan: p.keterangan?.[pilihanId]?.trim() ?? null,
                        oleh: masukan.oleh,
                        nama: masukan.nama,
                    });
                    baris += 1;
                }
            }
            return { alat: masukan.penilaian.length, baris };
        });
    }
    /** Ringkasan hasil penilaian: nilai per alat dan kategori yang bermasalah. */
    async ringkasan(peminjamanId, tahap) {
        return this.db.kueri(`
      SELECT pa.id AS peminjaman_alat_id, a.nama AS nama_alat,
             ROUND(SUM(kk.bobot * kk.nilai) / 100, 2) AS nilai,
             LISTAGG(CASE WHEN kk.nilai <> 100 THEN kk.keterangan END, ' | ')
               WITHIN GROUP (ORDER BY kk.grup) AS bermasalah
        FROM penilaian_kondisi pk
        JOIN peminjaman_alat pa  ON pa.id = pk.peminjaman_alat_id
        JOIN kategori_kondisi kk ON kk.id = pk.kategori_id
        LEFT JOIN alat a         ON a.id = pa.alat_id
       WHERE pa.peminjaman_id = :peminjamanId AND pk.tahap = :tahap
       GROUP BY pa.id, a.nama
       ORDER BY pa.id
      `, { peminjamanId, tahap });
    }
};
exports.PenilaianRepository = PenilaianRepository;
exports.PenilaianRepository = PenilaianRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [oracle_service_1.OracleService])
], PenilaianRepository);
//# sourceMappingURL=penilaian.repository.js.map