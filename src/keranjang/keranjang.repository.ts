import { Injectable } from '@nestjs/common';
import type { Connection } from 'oracledb';
import { OracleService } from '../basisdata/oracle.service';

export interface IsiKeranjang {
  id: number;
  alatId: number;
  nama: string;
  kodeBarcode: string | null;
  unit: string | null;
  bidang: string | null;
  tersedia: boolean;
}

@Injectable()
export class KeranjangRepository {
  constructor(private readonly db: OracleService) {}

  async isi(penggunaId: number): Promise<IsiKeranjang[]> {
    const baris = await this.db.kueri<Record<string, unknown>>(
      `
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
      `,
      { penggunaId },
    );
    return baris.map((r) => ({
      id: Number(r.ID),
      alatId: Number(r.ALAT_ID),
      nama: r.NAMA as string,
      kodeBarcode: (r.KODE_BARCODE as string) ?? null,
      unit: (r.UNIT as string) ?? null,
      bidang: (r.BIDANG as string) ?? null,
      tersedia: Number(r.DIPAKAI) === 0,
    }));
  }

  /** Menambah alat ke keranjang. Menambah alat yang sama dua kali tidak berefek. */
  async tambah(penggunaId: number, alatId: number): Promise<void> {
    await this.db.transaksi(async (koneksi) => {
      await koneksi.execute(
        `
        INSERT INTO keranjang (pengguna_id, alat_id)
        SELECT :penggunaId, :alatId FROM dual
         WHERE EXISTS (SELECT 1 FROM alat WHERE id = :alatId AND dihapus_pada IS NULL)
           AND NOT EXISTS (SELECT 1 FROM keranjang
                            WHERE pengguna_id = :penggunaId AND alat_id = :alatId)
        `,
        { penggunaId, alatId },
      );
    });
  }

  async hapus(penggunaId: number, alatId: number): Promise<void> {
    await this.db.transaksi(async (koneksi) => {
      await koneksi.execute(
        'DELETE FROM keranjang WHERE pengguna_id = :penggunaId AND alat_id = :alatId',
        { penggunaId, alatId },
      );
    });
  }

  async kosongkan(penggunaId: number, koneksi?: Connection): Promise<void> {
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
}
