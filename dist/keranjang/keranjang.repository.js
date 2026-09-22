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
exports.KeranjangRepository = void 0;
const common_1 = require("@nestjs/common");
const oracle_service_1 = require("../basisdata/oracle.service");
let KeranjangRepository = class KeranjangRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async isi(penggunaId) {
        const baris = await this.db.kueri(`
      SELECT k.id, a.id AS alat_id, a.nama, a.kode_barcode,
             u.nama AS unit, b.nama AS bidang,
             (SELECT COUNT(*) FROM peminjaman_alat pa
                JOIN peminjaman pm ON pm.id = pa.peminjaman_id
               WHERE pa.alat_id = a.id
                 AND UPPER(pm.status) NOT IN ('FINISH','PARTIAL FINISH','REJECT','REJECT PERPANJANGAN')
             ) AS dipakai
        FROM keranjang k
        JOIN alat a      ON a.id = k.alat_id
        LEFT JOIN unit u ON u.id = a.unit_id
        LEFT JOIN bidang b ON b.id = a.bidang_id
       WHERE k.pengguna_id = :penggunaId
       ORDER BY k.dibuat_pada, k.id
      `, { penggunaId });
        return baris.map((r) => ({
            id: Number(r.ID),
            alatId: Number(r.ALAT_ID),
            nama: r.NAMA,
            kodeBarcode: r.KODE_BARCODE ?? null,
            unit: r.UNIT ?? null,
            bidang: r.BIDANG ?? null,
            tersedia: Number(r.DIPAKAI) === 0,
        }));
    }
    /** Menambah alat ke keranjang. Menambah alat yang sama dua kali tidak berefek. */
    async tambah(penggunaId, alatId) {
        await this.db.transaksi(async (koneksi) => {
            await koneksi.execute(`
        INSERT INTO keranjang (pengguna_id, alat_id)
        SELECT :penggunaId, :alatId FROM dual
         WHERE EXISTS (SELECT 1 FROM alat WHERE id = :alatId AND dihapus_pada IS NULL)
           AND NOT EXISTS (SELECT 1 FROM keranjang
                            WHERE pengguna_id = :penggunaId AND alat_id = :alatId)
        `, { penggunaId, alatId });
        });
    }
    async hapus(penggunaId, alatId) {
        await this.db.transaksi(async (koneksi) => {
            await koneksi.execute('DELETE FROM keranjang WHERE pengguna_id = :penggunaId AND alat_id = :alatId', { penggunaId, alatId });
        });
    }
    async kosongkan(penggunaId, koneksi) {
        const sql = 'DELETE FROM keranjang WHERE pengguna_id = :penggunaId';
        if (koneksi) {
            // Dipanggil dari dalam transaksi checkout: mengosongkan keranjang harus
            // batal juga bila pengajuannya gagal.
            await koneksi.execute(sql, { penggunaId });
            return;
        }
        await this.db.transaksi(async (k) => {
            await k.execute(sql, { penggunaId });
        });
    }
};
exports.KeranjangRepository = KeranjangRepository;
exports.KeranjangRepository = KeranjangRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [oracle_service_1.OracleService])
], KeranjangRepository);
//# sourceMappingURL=keranjang.repository.js.map