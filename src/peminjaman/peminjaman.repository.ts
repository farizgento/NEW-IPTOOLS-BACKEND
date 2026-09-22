import { Injectable } from '@nestjs/common';
import type { Connection } from 'oracledb';
import oracledb from 'oracledb';
import { OracleService } from '../basisdata/oracle.service';
import type { KodeAlur, TahapApproval } from './alur';
import type { DugaanKembar } from './validasi';

export interface DataPengajuan {
  pekerjaan: string;
  unitId: number | null;
  tanggalMulai: string;
  tanggalSelesai: string;
  nomorWo: string;
  tujuan: string | null;
  kontak: string | null;
  peminjamId: number;
  namaPeminjam: string;
  alur: KodeAlur;
  rantai: TahapApproval[];
  alatIds: number[];
}

@Injectable()
export class PeminjamanRepository {
  constructor(private readonly db: OracleService) {}

  async idJenisAlur(kode: KodeAlur): Promise<number | null> {
    const baris = await this.db.kueriSatu<{ ID: number }>(
      `SELECT id FROM referensi WHERE tipe = 'JENIS_ALUR' AND kode = :kode`,
      { kode },
    );
    return baris ? Number(baris.ID) : null;
  }

  /** Alat yang masih terikat pengajuan berjalan milik orang yang sama. */
  async dugaanKembar(peminjamId: number, alatIds: number[]): Promise<DugaanKembar[]> {
    if (!alatIds.length) return [];
    const ikatan: Record<string, unknown> = { peminjamId };
    const nama = alatIds.map((id, i) => {
      ikatan[`a${i}`] = id;
      return `:a${i}`;
    });
    const baris = await this.db.kueri<Record<string, unknown>>(
      `
      SELECT pa.alat_id, a.nama, pm.id AS peminjaman_id, pm.status
        FROM peminjaman_alat pa
        JOIN peminjaman pm ON pm.id = pa.peminjaman_id
        JOIN alat a        ON a.id = pa.alat_id
       WHERE pm.peminjam_id = :peminjamId
         AND pa.alat_id IN (${nama.join(',')})
         AND UPPER(pm.status) NOT IN ('FINISH','PARTIAL FINISH','REJECT','REJECT PERPANJANGAN')
      `,
      ikatan,
    );
    return baris.map((r) => ({
      alatId: Number(r.ALAT_ID),
      namaAlat: r.NAMA as string,
      peminjamanId: Number(r.PEMINJAMAN_ID),
      status: r.STATUS as string,
    }));
  }

  /**
   * Menyimpan pengajuan beserta seluruh isinya dalam SATU transaksi.
   *
   * Prosedur lama melakukan COMMIT di tengah lalu bisa gagal sesudahnya,
   * sehingga pengajuan tersimpan tetapi dilaporkan gagal — pengguna mengulang
   * dan menghasilkan duplikat (PRD 2.5). Di sini tidak ada yang tersimpan
   * sampai seluruh langkah selesai.
   */
  async simpanPengajuan(
    data: DataPengajuan,
    setelahnya: (koneksi: Connection, peminjamanId: number) => Promise<void>,
  ): Promise<number> {
    return this.db.transaksi(async (koneksi) => {
      const jenisAlurId = await this.idJenisAlur(data.alur);

      const hasil = await koneksi.execute<{ id: number[] }>(
        `
        INSERT INTO peminjaman (
          pekerjaan, unit_id, tanggal_mulai, tanggal_selesai, nomor_wo,
          tujuan, kontak, jenis_alur_id, status,
          peminjam_id, nama_peminjam_historis, id_lama)
        VALUES (
          :pekerjaan, :unitId, TO_DATE(:mulai,'YYYY-MM-DD'), TO_DATE(:selesai,'YYYY-MM-DD'),
          :nomorWo, :tujuan, :kontak, :jenisAlurId, 'BOOKED',
          :peminjamId, :namaPeminjam, NULL)
        RETURNING id INTO :id
        `,
        {
          pekerjaan: data.pekerjaan,
          unitId: data.unitId,
          mulai: data.tanggalMulai,
          selesai: data.tanggalSelesai,
          nomorWo: data.nomorWo,
          tujuan: data.tujuan,
          kontak: data.kontak,
          jenisAlurId,
          peminjamId: data.peminjamId,
          namaPeminjam: data.namaPeminjam,
          id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        },
      );

      const peminjamanId = Number(hasil.outBinds?.id?.[0]);

      for (const alatId of data.alatIds) {
        await koneksi.execute(
          `
          INSERT INTO peminjaman_alat (peminjaman_id, alat_id, status, id_lama)
          VALUES (:peminjamanId, :alatId, 'DIAJUKAN', NULL)
          `,
          { peminjamanId, alatId },
        );
      }

      // Rantai approval dibuat sekaligus, satu baris per tahap. Panjangnya
      // ditentukan varian alur, bukan cabang if yang tersebar (PRD 9.1).
      let urutan = 0;
      for (const tahap of data.rantai) {
        urutan += 1;
        await koneksi.execute(
          `
          INSERT INTO peminjaman_approval (peminjaman_id, urutan, tahap, keputusan)
          VALUES (:peminjamanId, :urutan, :tahap, 'MENUNGGU')
          `,
          { peminjamanId, urutan, tahap },
        );
      }

      await koneksi.execute(
        `
        INSERT INTO peminjaman_riwayat (
          peminjaman_id, status_lama, status_baru, keterangan, oleh, nama_historis,
          dibuat_pada, id_lama)
        VALUES (:peminjamanId, NULL, 'BOOKED', :keterangan, :oleh, :nama,
                SYSTIMESTAMP, NULL)
        `,
        {
          peminjamanId,
          keterangan: `Pengajuan dibuat (${data.alur})`,
          oleh: data.peminjamId,
          nama: data.namaPeminjam,
        },
      );

      await setelahnya(koneksi, peminjamanId);
      return peminjamanId;
    });
  }

  async detail(id: number): Promise<Record<string, unknown> | undefined> {
    return this.db.kueriSatu(
      `
      SELECT pm.id, pm.pekerjaan, pm.status, pm.nomor_wo,
             TO_CHAR(pm.tanggal_mulai,'YYYY-MM-DD')   AS tanggal_mulai,
             TO_CHAR(pm.tanggal_selesai,'YYYY-MM-DD') AS tanggal_selesai,
             u.nama AS unit, r.nama AS jenis_alur, pm.nama_peminjam_historis AS peminjam,
             (SELECT COUNT(*) FROM peminjaman_alat pa WHERE pa.peminjaman_id = pm.id) AS jumlah_alat
        FROM peminjaman pm
        LEFT JOIN unit u      ON u.id = pm.unit_id
        LEFT JOIN referensi r ON r.id = pm.jenis_alur_id
       WHERE pm.id = :id
      `,
      { id },
    );
  }

  async milikSaya(peminjamId: number): Promise<Record<string, unknown>[]> {
    return this.db.kueri(
      `
      SELECT pm.id, pm.pekerjaan, pm.status, pm.nomor_wo,
             TO_CHAR(pm.tanggal_mulai,'YYYY-MM-DD')   AS tanggal_mulai,
             TO_CHAR(pm.tanggal_selesai,'YYYY-MM-DD') AS tanggal_selesai,
             r.nama AS jenis_alur,
             (SELECT COUNT(*) FROM peminjaman_alat pa WHERE pa.peminjaman_id = pm.id) AS jumlah_alat
        FROM peminjaman pm
        LEFT JOIN referensi r ON r.id = pm.jenis_alur_id
       WHERE pm.peminjam_id = :peminjamId
       ORDER BY pm.dibuat_pada DESC
       FETCH FIRST 50 ROWS ONLY
      `,
      { peminjamId },
    );
  }
}
