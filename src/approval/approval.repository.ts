import { Injectable } from '@nestjs/common';
import type { Connection } from 'oracledb';
import { OracleService } from '../basisdata/oracle.service';
import type { TahapApproval } from '../peminjaman/alur';
import type { BarisApproval, Keputusan } from './keputusan';

export interface ItemAntrean {
  peminjamanId: number;
  pekerjaan: string | null;
  peminjam: string | null;
  unit: string | null;
  jenisAlur: string | null;
  tanggalMulai?: string | null;
  tanggalSelesai?: string | null;
  jumlahAlat: number;
  tahap: TahapApproval;
  status: string;
  menungguSejak: string | null;
  umurHari: number;
}

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

@Injectable()
export class ApprovalRepository {
  constructor(private readonly db: OracleService) {}

  async antrean(tahapList: TahapApproval[], unitId: number): Promise<ItemAntrean[]> {
    if (!tahapList.length || !unitId) return [];

    // Daftar tahap diikat sebagai larik, bukan dirangkai ke teks SQL.
    const baris = await this.db.kueri<Record<string, unknown>>(ANTREAN, {
      tahapList: {
        type: 'SYS.ODCIVARCHAR2LIST' as unknown as number,
        val: tahapList,
      },
      unitId,
    });

    const sekarang = Date.now();
    return baris.map((r) => {
      const sejak = r.MENUNGGU_SEJAK ? new Date(String(r.MENUNGGU_SEJAK)) : null;
      return {
        peminjamanId: Number(r.PEMINJAMAN_ID),
        pekerjaan: (r.PEKERJAAN as string) ?? null,
        peminjam: (r.PEMINJAM as string) ?? null,
        unit: (r.UNIT as string) ?? null,
        jenisAlur: (r.JENIS_ALUR as string) ?? null,
        tanggalMulai: (r.TANGGAL_MULAI as string) ?? null,
        tanggalSelesai: (r.TANGGAL_SELESAI as string) ?? null,
        jumlahAlat: Number(r.JUMLAH_ALAT ?? 0),
        tahap: r.TAHAP as TahapApproval,
        status: r.STATUS as string,
        menungguSejak: sejak ? sejak.toISOString() : null,
        umurHari: sejak ? Math.floor((sekarang - sejak.getTime()) / 86_400_000) : 0,
      };
    });
  }

  async rantai(peminjamanId: number): Promise<BarisApproval[]> {
    const baris = await this.db.kueri<Record<string, unknown>>(
      `SELECT urutan, tahap, keputusan FROM peminjaman_approval
        WHERE peminjaman_id = :peminjamanId ORDER BY urutan`,
      { peminjamanId },
    );
    return baris.map((r) => ({
      urutan: Number(r.URUTAN),
      tahap: r.TAHAP as TahapApproval,
      keputusan: r.KEPUTUSAN as Keputusan,
    }));
  }

  /** Isi layar keputusan: identitas pengajuan, daftar alat, riwayat approval. */
  async berkas(peminjamanId: number): Promise<{
    pengajuan: Record<string, unknown> | undefined;
    alat: Record<string, unknown>[];
    approval: Record<string, unknown>[];
  }> {
    const pengajuan = await this.db.kueriSatu(
      `
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
      `,
      { peminjamanId },
    );

    const alat = await this.db.kueri(
      `
      SELECT pa.id, a.nama, a.kode_barcode, pa.status,
             ru.nama AS unit, rk.nama AS kondisi, rl.nama AS lokasi
        FROM peminjaman_alat pa
        LEFT JOIN alat a       ON a.id  = pa.alat_id
        LEFT JOIN unit ru      ON ru.id = a.unit_id
        LEFT JOIN referensi rk ON rk.id = a.kondisi_id
        LEFT JOIN referensi rl ON rl.id = a.lokasi_id
       WHERE pa.peminjaman_id = :peminjamanId
       ORDER BY pa.id
      `,
      { peminjamanId },
    );

    const approval = await this.db.kueri(
      `
      SELECT ap.urutan, ap.tahap, ap.keputusan, ap.alasan,
             NVL(p.nama, ap.nama_penyetuju_historis) AS penyetuju,
             TO_CHAR(ap.diputuskan_pada,'YYYY-MM-DD HH24:MI') AS diputuskan_pada,
             ap.disusun_ulang
        FROM peminjaman_approval ap
        LEFT JOIN pengguna p ON p.id = ap.penyetuju_id
       WHERE ap.peminjaman_id = :peminjamanId
       ORDER BY ap.urutan
      `,
      { peminjamanId },
    );

    return { pengajuan, alat, approval };
  }

  /**
   * Menyimpan keputusan: baris approval, status pengajuan, dan riwayatnya —
   * seluruhnya dalam satu transaksi.
   */
  async simpanKeputusan(masukan: {
    peminjamanId: number;
    urutan: number;
    keputusan: 'SETUJU' | 'TOLAK';
    alasan: string | null;
    statusBaru: string;
    statusLama: string;
    penyetujuId: number;
    namaPenyetuju: string;
    keterangan: string;
  }): Promise<void> {
    await this.db.transaksi(async (koneksi: Connection) => {
      const hasil = await koneksi.execute(
        `
        UPDATE peminjaman_approval
           SET keputusan = :keputusan,
               alasan = :alasan,
               penyetuju_id = :penyetujuId,
               nama_penyetuju_historis = :namaPenyetuju,
               diputuskan_pada = SYSTIMESTAMP
         WHERE peminjaman_id = :peminjamanId
           AND urutan = :urutan
           AND keputusan = 'MENUNGGU'
        `,
        {
          keputusan: masukan.keputusan,
          alasan: masukan.alasan,
          penyetujuId: masukan.penyetujuId,
          namaPenyetuju: masukan.namaPenyetuju,
          peminjamanId: masukan.peminjamanId,
          urutan: masukan.urutan,
        },
      );

      // Syarat keputusan = 'MENUNGGU' di atas menutup balapan: bila dua orang
      // menekan tombol bersamaan, hanya satu yang mengubah baris.
      if (!hasil.rowsAffected) {
        throw new Error('Tahap ini sudah diputuskan orang lain');
      }

      await koneksi.execute(
        `UPDATE peminjaman SET status = :statusBaru, diubah_pada = SYSTIMESTAMP
          WHERE id = :peminjamanId`,
        { statusBaru: masukan.statusBaru, peminjamanId: masukan.peminjamanId },
      );

      await koneksi.execute(
        `
        INSERT INTO peminjaman_riwayat (
          peminjaman_id, status_lama, status_baru, keterangan, oleh, nama_historis, dibuat_pada)
        VALUES (:peminjamanId, :statusLama, :statusBaru, :keterangan, :oleh, :nama, SYSTIMESTAMP)
        `,
        {
          peminjamanId: masukan.peminjamanId,
          statusLama: masukan.statusLama,
          statusBaru: masukan.statusBaru,
          keterangan: masukan.keterangan,
          oleh: masukan.penyetujuId,
          nama: masukan.namaPenyetuju,
        },
      );
    });
  }
}
