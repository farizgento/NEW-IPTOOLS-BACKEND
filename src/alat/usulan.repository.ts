import { Injectable } from '@nestjs/common';
import oracledb from 'oracledb';
import { OracleService } from '../basisdata/oracle.service';
import {
  KOLOM_ALAT,
  susunPerubahan,
  type IsiUsulan,
  type StatusUsulan,
  type TindakanUsulan,
} from './usulan';

export interface Usulan {
  id: number;
  alatId: number | null;
  namaAlat: string | null;
  tindakan: string;
  status: string;
  isi: IsiUsulan;
  pengusul: string | null;
  dibuatPada: string | null;
}

@Injectable()
export class UsulanRepository {
  constructor(private readonly db: OracleService) {}

  private ke(r: Record<string, unknown>): Usulan {
    let isi: IsiUsulan = {};
    try {
      isi = r.ISI_USULAN ? (JSON.parse(String(r.ISI_USULAN)) as IsiUsulan) : {};
    } catch {
      isi = {};
    }
    return {
      id: Number(r.ID),
      alatId: r.ALAT_ID === null ? null : Number(r.ALAT_ID),
      namaAlat: (r.NAMA_ALAT as string) ?? null,
      tindakan: r.TINDAKAN as string,
      status: r.STATUS as string,
      isi,
      pengusul: (r.PENGUSUL as string) ?? null,
      dibuatPada: r.DIBUAT_PADA ? String(r.DIBUAT_PADA) : null,
    };
  }

  private readonly PILIH = `
    SELECT u.id, u.alat_id, a.nama AS nama_alat, u.tindakan, u.status, u.isi_usulan,
           NVL(p.nama, u.nama_pengusul_historis) AS pengusul,
           TO_CHAR(u.dibuat_pada, 'YYYY-MM-DD HH24:MI') AS dibuat_pada
      FROM alat_usulan_perubahan u
      LEFT JOIN alat a     ON a.id = u.alat_id
      LEFT JOIN pengguna p ON p.id = u.diusulkan_oleh
  `;

  async ambil(id: number): Promise<Usulan | undefined> {
    const baris = await this.db.kueriSatu<Record<string, unknown>>(
      `${this.PILIH} WHERE u.id = :id`,
      { id },
    );
    return baris ? this.ke(baris) : undefined;
  }

  /** Antrean usulan yang menunggu keputusan, yang terlama lebih dulu. */
  async menunggu(): Promise<Usulan[]> {
    const baris = await this.db.kueri<Record<string, unknown>>(
      `${this.PILIH} WHERE u.status = 'WAITING APPROVAL' ORDER BY u.dibuat_pada`,
    );
    return baris.map((r) => this.ke(r));
  }

  /** Referensi jenis, kondisi, dan lokasi alat untuk memetakan nama di usulan lama. */
  async referensiAlat() {
    return this.db.kueri<{ TIPE: string; ID: number; NAMA: string }>(
      `SELECT tipe, id, nama FROM referensi
        WHERE tipe IN ('JENIS_ALAT', 'KONDISI_ALAT', 'LOKASI_ALAT')
        ORDER BY aktif DESC, dari_migrasi, urutan, id`,
    );
  }

  async jumlahMenunggu(alatId: number): Promise<number> {
    const baris = await this.db.kueriSatu<{ N: number }>(
      `SELECT COUNT(*) AS n FROM alat_usulan_perubahan
        WHERE alat_id = :alatId AND status = 'WAITING APPROVAL'`,
      { alatId },
    );
    return Number(baris?.N ?? 0);
  }

  async riwayat(alatId: number) {
    return this.db.kueri(
      `
      SELECT u.id AS usulan_id, u.tindakan, r.status, r.keterangan,
             NVL(p.nama, r.nama_historis) AS oleh,
             TO_CHAR(r.dibuat_pada, 'YYYY-MM-DD HH24:MI') AS pada
        FROM alat_usulan_riwayat r
        JOIN alat_usulan_perubahan u ON u.id = r.usulan_id
        LEFT JOIN pengguna p          ON p.id = r.oleh
       WHERE u.alat_id = :alatId
       ORDER BY r.dibuat_pada DESC, r.id DESC
      `,
      { alatId },
    );
  }

  async buatUsulan(masukan: {
    alatId: number;
    tindakan: TindakanUsulan;
    isi: IsiUsulan;
    keterangan: string | null;
    oleh: number;
    nama: string;
  }): Promise<number> {
    return this.db.transaksi(async (koneksi) => {
      const hasil = await koneksi.execute<{ id: number[] }>(
        `
        INSERT INTO alat_usulan_perubahan (
          alat_id, tindakan, isi_usulan, keterangan, status,
          diusulkan_oleh, nama_pengusul_historis, id_lama)
        VALUES (:alatId, :tindakan, :isi, :keterangan, 'WAITING APPROVAL',
                :oleh, :nama, NULL)
        RETURNING id INTO :id
        `,
        {
          alatId: masukan.alatId,
          tindakan: masukan.tindakan,
          isi: JSON.stringify(masukan.isi),
          keterangan: masukan.keterangan,
          oleh: masukan.oleh,
          nama: masukan.nama,
          id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        },
      );
      const id = Number(hasil.outBinds?.id?.[0]);

      await koneksi.execute(
        `INSERT INTO alat_usulan_riwayat (usulan_id, status, keterangan, oleh, nama_historis, id_lama)
         VALUES (:id, 'WAITING APPROVAL', :keterangan, :oleh, :nama, NULL)`,
        { id, keterangan: masukan.keterangan, oleh: masukan.oleh, nama: masukan.nama },
      );
      return id;
    });
  }

  /**
   * Menerapkan keputusan: usulan, alat, dan riwayatnya dalam SATU transaksi.
   *
   * Syarat `status = 'WAITING APPROVAL'` pada UPDATE usulan menutup balapan dua
   * admin yang memutuskan bersamaan — hanya satu yang berhasil mengubah baris.
   */
  async putuskan(masukan: {
    usulanId: number;
    alatId: number | null;
    tindakan: string;
    isi: IsiUsulan;
    status: StatusUsulan;
    keterangan: string | null;
    oleh: number;
    nama: string;
  }): Promise<void> {
    await this.db.transaksi(async (koneksi) => {
      const hasil = await koneksi.execute(
        `UPDATE alat_usulan_perubahan SET status = :status
          WHERE id = :id AND status = 'WAITING APPROVAL'`,
        { status: masukan.status, id: masukan.usulanId },
      );
      if (!hasil.rowsAffected) {
        throw new Error('Usulan ini sudah diputuskan orang lain');
      }

      if (masukan.status === 'APPROVE' && masukan.alatId !== null) {
        if (masukan.tindakan === 'HAPUS') {
          // Penghapusan berarti mengisi penanda, bukan menyalin ke tabel arsip
          // seperti DAFTAR_TOOL_DELETED di sistem lama (PRD 6.3).
          await koneksi.execute(
            `UPDATE alat SET dihapus_pada = SYSTIMESTAMP WHERE id = :alatId`,
            { alatId: masukan.alatId },
          );
        } else {
          const { set, ikatan } = susunPerubahan(masukan.isi);
          if (set) {
            await koneksi.execute(`UPDATE alat SET ${set} WHERE id = :alatId`, {
              ...ikatan,
              alatId: masukan.alatId,
            });
          }
        }
      }

      await koneksi.execute(
        `INSERT INTO alat_usulan_riwayat (usulan_id, status, keterangan, oleh, nama_historis, id_lama)
         VALUES (:usulanId, :status, :keterangan, :oleh, :nama, NULL)`,
        {
          usulanId: masukan.usulanId,
          status: masukan.status,
          keterangan: masukan.keterangan,
          oleh: masukan.oleh,
          nama: masukan.nama,
        },
      );
    });
  }

  /**
   * Menambah alat baru secara langsung.
   *
   * Sistem lama menambah alat tanpa persetujuan, sementara mengubahnya butuh
   * persetujuan. Perilaku itu dibawa apa adanya selama pemilik proses belum
   * memutuskan sebaliknya (PRD 12.9).
   */
  async tambah(isi: IsiUsulan, oleh: number): Promise<number> {
    const kolom: string[] = [];
    const nilai: string[] = [];
    const ikatan: Record<string, unknown> = {};
    for (const [bidang, isian] of Object.entries(isi)) {
      const k = KOLOM_ALAT[bidang as keyof typeof KOLOM_ALAT];
      if (!k) continue;
      kolom.push(k);
      nilai.push(`:${bidang}`);
      ikatan[bidang] = isian === '' ? null : isian;
    }

    return this.db.transaksi(async (koneksi) => {
      const hasil = await koneksi.execute<{ id: number[] }>(
        `INSERT INTO alat (${[...kolom, 'dibuat_oleh', 'id_lama'].join(', ')})
         VALUES (${[...nilai, ':dibuatOleh', 'NULL'].join(', ')})
         RETURNING id INTO :id`,
        {
          ...ikatan,
          dibuatOleh: oleh,
          id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        },
      );
      return Number(hasil.outBinds?.id?.[0]);
    });
  }
}
