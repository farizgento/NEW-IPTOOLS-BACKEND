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
exports.JadwalRepository = void 0;
const common_1 = require("@nestjs/common");
const oracle_service_1 = require("../basisdata/oracle.service");
const jadwal_1 = require("./jadwal");
let JadwalRepository = class JadwalRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * Jadwal pemakaian alat pada rentang tanggal, satu baris per alat.
     *
     * Pengajuan yang ditolak tidak pernah ikut: alatnya tidak pernah benar-benar
     * dipesan. Batas jumlah alat menjaga tampilan tetap ringan — data lama punya
     * peminjaman dengan periode bertahun-tahun.
     */
    async perAlat(filter, hariIni) {
        const ikatan = {
            dari: filter.dari,
            sampai: filter.sampai,
            batas: filter.batasAlat,
        };
        const syarat = [
            "pm.status <> 'REJECT'",
            "pm.tanggal_selesai >= TO_DATE(:dari,'YYYY-MM-DD')",
            "pm.tanggal_mulai <= TO_DATE(:sampai,'YYYY-MM-DD')",
            'a.dihapus_pada IS NULL',
        ];
        if (filter.unitId) {
            ikatan.unitId = filter.unitId;
            syarat.push('a.unit_id = :unitId');
        }
        if (filter.bidangId) {
            ikatan.bidangId = filter.bidangId;
            syarat.push('a.bidang_id = :bidangId');
        }
        if (filter.cari?.trim()) {
            ikatan.cari = `%${filter.cari.trim().toUpperCase()}%`;
            syarat.push(`(UPPER(a.nama) LIKE :cari OR UPPER(a.kode_barcode) LIKE :cari
                    OR UPPER(pm.pekerjaan) LIKE :cari
                    OR UPPER(NVL(pg.nama, pm.nama_peminjam_historis)) LIKE :cari)`);
        }
        const rows = await this.db.kueri(`
      WITH terpilih AS (
        SELECT DISTINCT pa.alat_id
          FROM peminjaman_alat pa
          JOIN peminjaman pm ON pm.id = pa.peminjaman_id
          JOIN alat a ON a.id = pa.alat_id
          LEFT JOIN pengguna pg ON pg.id = pm.peminjam_id
         WHERE ${syarat.join(' AND ')}
         FETCH FIRST :batas ROWS ONLY
      )
      SELECT pa.id AS pa_id, pm.id AS peminjaman_id, pa.alat_id,
             TRIM(a.kode_barcode) AS kode_barcode, TRIM(a.nama) AS nama,
             TRIM(u.nama) AS unit, TRIM(rj.nama) AS jenis, TRIM(b.nama) AS bidang,
             TRIM(pm.pekerjaan) AS pekerjaan,
             TRIM(NVL(pg.nama, pm.nama_peminjam_historis)) AS peminjam,
             TO_CHAR(pm.tanggal_mulai,'YYYY-MM-DD') AS mulai,
             TO_CHAR(pm.tanggal_selesai,'YYYY-MM-DD') AS selesai,
             pa.status AS status_alat,
             TO_CHAR(pa.tanggal_kembali,'YYYY-MM-DD') AS tgl_kembali
        FROM peminjaman_alat pa
        JOIN peminjaman pm ON pm.id = pa.peminjaman_id
        JOIN alat a ON a.id = pa.alat_id
        JOIN terpilih t ON t.alat_id = pa.alat_id
        LEFT JOIN unit u ON u.id = a.unit_id
        LEFT JOIN referensi rj ON rj.id = a.jenis_id
        LEFT JOIN bidang b ON b.id = a.bidang_id
        LEFT JOIN pengguna pg ON pg.id = pm.peminjam_id
       WHERE pm.status <> 'REJECT'
         AND pm.tanggal_selesai >= TO_DATE(:dari,'YYYY-MM-DD')
         AND pm.tanggal_mulai <= TO_DATE(:sampai,'YYYY-MM-DD')
       ORDER BY a.nama, pm.tanggal_mulai
      `, ikatan);
        const peta = new Map();
        for (const b of rows) {
            const alatId = Number(b.ALAT_ID);
            if (!peta.has(alatId)) {
                peta.set(alatId, {
                    alatId,
                    kodeBarcode: b.KODE_BARCODE,
                    nama: b.NAMA,
                    unit: b.UNIT,
                    jenis: b.JENIS,
                    bidang: b.BIDANG,
                    bertabrakan: false,
                    jadwal: [],
                    mentah: [],
                    ket: new Map(),
                });
            }
            const baris = peta.get(alatId);
            baris.mentah.push({
                peminjamanAlatId: Number(b.PA_ID),
                peminjamanId: Number(b.PEMINJAMAN_ID),
                alatId,
                mulai: b.MULAI,
                selesai: b.SELESAI,
                statusAlat: b.STATUS_ALAT,
                tanggalKembali: b.TGL_KEMBALI,
            });
            baris.ket.set(Number(b.PA_ID), b);
        }
        return [...peta.values()].map((baris) => {
            const jadwal = (0, jadwal_1.tandaiTabrakan)(baris.mentah, hariIni).map((j) => {
                const ket = baris.ket.get(j.peminjamanAlatId);
                return { ...j, pekerjaan: ket?.PEKERJAAN ?? null, peminjam: ket?.PEMINJAM ?? null };
            });
            return {
                alatId: baris.alatId,
                kodeBarcode: baris.kodeBarcode,
                nama: baris.nama,
                unit: baris.unit,
                jenis: baris.jenis,
                bidang: baris.bidang,
                bertabrakan: jadwal.some((j) => j.tabrakDengan.length > 0),
                jadwal,
            };
        });
    }
    /**
     * Jadwal lain pada alat yang sama yang bertumpuk dengan periode yang diminta.
     * Dipakai saat mengajukan dan saat pengelola memutuskan, sebagai peringatan.
     */
    async tabrakanUntuk(alatIds, mulai, selesai, kecualiPeminjamanId) {
        if (!alatIds.length)
            return [];
        const ikatan = { mulai, selesai };
        const penanda = alatIds.map((id, i) => {
            ikatan[`alat${i}`] = id;
            return `:alat${i}`;
        });
        if (kecualiPeminjamanId)
            ikatan.kecuali = kecualiPeminjamanId;
        const rows = await this.db.kueri(`
      SELECT pa.id AS pa_id, pm.id AS peminjaman_id, pa.alat_id,
             TRIM(pm.pekerjaan) AS pekerjaan,
             TRIM(NVL(pg.nama, pm.nama_peminjam_historis)) AS peminjam,
             TO_CHAR(pm.tanggal_mulai,'YYYY-MM-DD') AS mulai,
             TO_CHAR(pm.tanggal_selesai,'YYYY-MM-DD') AS selesai,
             pa.status AS status_alat,
             TO_CHAR(pa.tanggal_kembali,'YYYY-MM-DD') AS tgl_kembali,
             NULL AS kode_barcode, NULL AS nama, NULL AS unit, NULL AS jenis, NULL AS bidang
        FROM peminjaman_alat pa
        JOIN peminjaman pm ON pm.id = pa.peminjaman_id
        LEFT JOIN pengguna pg ON pg.id = pm.peminjam_id
       WHERE pa.alat_id IN (${penanda.join(', ')})
         AND pm.status <> 'REJECT'
         AND pa.status <> 'SELESAI'
         AND pa.tanggal_kembali IS NULL
         AND pm.tanggal_selesai >= TO_DATE(:mulai,'YYYY-MM-DD')
         AND pm.tanggal_mulai <= TO_DATE(:selesai,'YYYY-MM-DD')
         ${kecualiPeminjamanId ? 'AND pm.id <> :kecuali' : ''}
       ORDER BY pm.tanggal_mulai
      `, ikatan);
        return rows.map((b) => ({
            alatId: Number(b.ALAT_ID),
            peminjamanId: Number(b.PEMINJAMAN_ID),
            pekerjaan: b.PEKERJAAN,
            peminjam: b.PEMINJAM,
            mulai: b.MULAI,
            selesai: b.SELESAI,
            statusAlat: b.STATUS_ALAT,
        }));
    }
};
exports.JadwalRepository = JadwalRepository;
exports.JadwalRepository = JadwalRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [oracle_service_1.OracleService])
], JadwalRepository);
//# sourceMappingURL=jadwal.repository.js.map