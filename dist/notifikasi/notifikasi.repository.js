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
exports.NotifikasiRepository = void 0;
const common_1 = require("@nestjs/common");
const oracledb_1 = __importDefault(require("oracledb"));
const oracle_service_1 = require("../basisdata/oracle.service");
let NotifikasiRepository = class NotifikasiRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * Serah terima yang sudah diserahkan tetapi masih menyisakan alat yang belum
     * dikonfirmasi. Jenjang yang sudah pernah dikirim ikut dibaca agar tidak
     * berulang.
     */
    async calonKonfirmasi() {
        const baris = await this.db.kueri(`
      SELECT st.id AS serah_terima_id, st.peminjaman_id, st.diserahkan_pada,
             pm.peminjam_id, p.email AS penerima_email,
             NVL(p.nama, pm.nama_peminjam_historis) AS nama_penerima,
             (SELECT COUNT(*) FROM serah_terima_alat x
               WHERE x.serah_terima_id = st.id AND x.dikonfirmasi_pada IS NULL) AS jumlah_belum,
             (SELECT LISTAGG(n.perihal, '|') WITHIN GROUP (ORDER BY n.id)
                FROM notifikasi n
               WHERE n.entitas = 'SERAH_TERIMA' AND n.entitas_id = st.id
                 AND n.status IN ('TERKIRIM','MENUNGGU')) AS sudah
        FROM serah_terima st
        JOIN peminjaman pm   ON pm.id = st.peminjaman_id
        LEFT JOIN pengguna p ON p.id = pm.peminjam_id
       WHERE st.status IN ('SENT','RETURN')
         AND st.diserahkan_pada IS NOT NULL
         AND EXISTS (SELECT 1 FROM serah_terima_alat x
                      WHERE x.serah_terima_id = st.id AND x.dikonfirmasi_pada IS NULL)
         -- Data lama menyimpan ratusan serah terima tanpa tanda konfirmasi pada
         -- pengajuan yang sudah lama selesai. Tanpa syarat ini, penerimanya
         -- diingatkan untuk alat yang sudah dikembalikan bertahun-tahun lalu.
         AND pm.status IN ('SENT','PARTIAL SENT','PARTIAL RECEIVED','RETURN','PARTIAL RETURN')
    `);
        return baris.map((r) => ({
            serahTerimaId: Number(r.SERAH_TERIMA_ID),
            peminjamanId: Number(r.PEMINJAMAN_ID),
            penerimaId: r.PEMINJAM_ID === null ? null : Number(r.PEMINJAM_ID),
            penerimaEmail: r.PENERIMA_EMAIL ?? null,
            namaPenerima: r.NAMA_PENERIMA ?? 'Peminjam',
            jumlahBelum: Number(r.JUMLAH_BELUM ?? 0),
            diserahkanPada: new Date(String(r.DISERAHKAN_PADA)),
            sudahDikirim: bacaJenjang(r.SUDAH),
        }));
    }
    /** Peminjaman berjalan yang mendekati atau melewati tanggal pengembalian. */
    async calonPengembalian() {
        const baris = await this.db.kueri(`
      SELECT pm.id AS peminjaman_id, pm.tanggal_selesai, pm.peminjam_id,
             p.email AS penerima_email,
             NVL(p.nama, pm.nama_peminjam_historis) AS nama_penerima,
             (SELECT COUNT(*) FROM peminjaman_alat pa WHERE pa.peminjaman_id = pm.id) AS jumlah_alat,
             (SELECT LISTAGG(n.perihal, '|') WITHIN GROUP (ORDER BY n.id)
                FROM notifikasi n
               WHERE n.entitas = 'PEMINJAMAN' AND n.entitas_id = pm.id
                 AND n.status IN ('TERKIRIM','MENUNGGU')) AS sudah
        FROM peminjaman pm
        LEFT JOIN pengguna p ON p.id = pm.peminjam_id
       WHERE UPPER(pm.status) IN ('RECEIVED','PARTIAL RECEIVED','SENT','PARTIAL SENT')
         AND pm.tanggal_selesai IS NOT NULL
    `);
        return baris.map((r) => ({
            peminjamanId: Number(r.PEMINJAMAN_ID),
            penerimaId: r.PEMINJAM_ID === null ? null : Number(r.PEMINJAM_ID),
            penerimaEmail: r.PENERIMA_EMAIL ?? null,
            namaPenerima: r.NAMA_PENERIMA ?? 'Peminjam',
            jumlahAlat: Number(r.JUMLAH_ALAT ?? 0),
            tanggalSelesai: new Date(String(r.TANGGAL_SELESAI)),
            sudahDikirim: bacaJenjang(r.SUDAH),
        }));
    }
    async antrekan(masukan) {
        return this.db.transaksi(async (koneksi) => {
            const hasil = await koneksi.execute(`
        INSERT INTO notifikasi (penerima_id, penerima_email, kanal, perihal, isi,
                                tautan, entitas, entitas_id, jadwal_kirim, status)
        VALUES (:penerimaId, :penerimaEmail, :kanal, :perihal, :isi,
                :tautan, :entitas, :entitasId, SYSTIMESTAMP, 'MENUNGGU')
        RETURNING id INTO :id
        `, { ...masukan, id: { dir: oracledb_1.default.BIND_OUT, type: oracledb_1.default.NUMBER } });
            return Number(hasil.outBinds?.id?.[0]);
        });
    }
    /** Notifikasi yang sudah waktunya dikirim. */
    async siapKirim(batas = 50) {
        return this.db.kueri(`
      SELECT id, penerima_email, kanal, perihal, isi, tautan, percobaan
        FROM notifikasi
       WHERE status = 'MENUNGGU' AND jadwal_kirim <= SYSTIMESTAMP
       ORDER BY jadwal_kirim
       FETCH FIRST :batas ROWS ONLY
      `, { batas });
    }
    async tandaiTerkirim(id) {
        await this.db.transaksi(async (koneksi) => {
            await koneksi.execute(`UPDATE notifikasi SET status = 'TERKIRIM', terkirim_pada = SYSTIMESTAMP,
                percobaan = percobaan + 1
          WHERE id = :id`, { id });
        });
    }
    /**
     * Mencatat kegagalan pengiriman tanpa membuangnya.
     *
     * Setelah lima percobaan notifikasi berhenti dicoba, tetapi barisnya tetap
     * ada beserta galat terakhirnya — sistem lama tidak mencatat apa pun,
     * sehingga tidak ada cara mengetahui pengingat mana yang tidak sampai.
     */
    async tandaiGagal(id, galat, batasPercobaan = 5) {
        await this.db.transaksi(async (koneksi) => {
            await koneksi.execute(`
        UPDATE notifikasi
           SET percobaan = percobaan + 1,
               galat_terakhir = :galat,
               status = CASE WHEN percobaan + 1 >= :batas THEN 'GAGAL' ELSE 'MENUNGGU' END
         WHERE id = :id
        `, { galat: galat.slice(0, 1000), batas: batasPercobaan, id });
        });
    }
    async ringkasan() {
        const baris = await this.db.kueri(`SELECT status, kanal, COUNT(*) AS jumlah FROM notifikasi GROUP BY status, kanal`);
        return baris.map((r) => ({
            status: r.STATUS,
            kanal: r.KANAL,
            jumlah: Number(r.JUMLAH),
        }));
    }
};
exports.NotifikasiRepository = NotifikasiRepository;
exports.NotifikasiRepository = NotifikasiRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [oracle_service_1.OracleService])
], NotifikasiRepository);
/** Jenjang dibaca dari perihal notifikasi yang sudah pernah dibuat. */
function bacaJenjang(gabungan) {
    if (!gabungan)
        return [];
    const hasil = [];
    for (const bagian of gabungan.split('|')) {
        const cocok = bagian.match(/\[(H1|H3|H7|JATUH_TEMPO|TERLAMBAT)\]/);
        if (cocok?.[1])
            hasil.push(cocok[1]);
    }
    return hasil;
}
//# sourceMappingURL=notifikasi.repository.js.map