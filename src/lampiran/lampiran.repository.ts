import { Injectable } from '@nestjs/common';
import oracledb from 'oracledb';
import { OracleService } from '../basisdata/oracle.service';
import type { EntitasLampiran } from './berkas';

export interface Lampiran {
  id: number;
  entitas: EntitasLampiran;
  entitasId: number;
  jenis: string;
  namaBerkas: string;
  lokasi: string | null;
  tipeMedia: string | null;
  ukuranBita: number | null;
  berkasHilang: boolean;
  diunggahOleh: number | null;
  dibuatPada: string | null;
}

/**
 * Kolom SQL: id foto utama sebuah alat — foto berurutan terkecil yang berkasnya
 * benar-benar tersimpan. Foto hasil migrasi yang fisiknya belum dipindahkan
 * dilewati, supaya katalog tidak menampilkan gambar rusak.
 */
export const sqlFotoUtama = (kolomAlatId: string) => `(
  SELECT MIN(f.id) KEEP (DENSE_RANK FIRST ORDER BY f.urutan, f.id)
    FROM lampiran f
   WHERE f.entitas = 'ALAT' AND f.entitas_id = ${kolomAlatId} AND f.jenis = 'GAMBAR'
     AND f.lokasi IS NOT NULL AND f.berkas_hilang = 0)`;

@Injectable()
export class LampiranRepository {
  constructor(private readonly db: OracleService) {}

  private ke(r: Record<string, unknown>): Lampiran {
    return {
      id: Number(r.ID),
      entitas: r.ENTITAS as EntitasLampiran,
      entitasId: Number(r.ENTITAS_ID),
      jenis: r.JENIS as string,
      namaBerkas: r.NAMA_BERKAS as string,
      lokasi: (r.LOKASI as string) ?? null,
      tipeMedia: (r.TIPE_MEDIA as string) ?? null,
      ukuranBita: r.UKURAN_BITA === null ? null : Number(r.UKURAN_BITA),
      berkasHilang: Number(r.BERKAS_HILANG ?? 0) === 1,
      diunggahOleh: r.DIUNGGAH_OLEH === null ? null : Number(r.DIUNGGAH_OLEH),
      dibuatPada: r.DIBUAT_PADA ? String(r.DIBUAT_PADA) : null,
    };
  }

  private readonly PILIH = `
    SELECT id, entitas, entitas_id, jenis, nama_berkas, lokasi, tipe_media,
           ukuran_bita, berkas_hilang, diunggah_oleh,
           TO_CHAR(dibuat_pada, 'YYYY-MM-DD HH24:MI') AS dibuat_pada
      FROM lampiran
  `;

  async daftar(entitas: EntitasLampiran, entitasId: number): Promise<Lampiran[]> {
    const baris = await this.db.kueri<Record<string, unknown>>(
      `${this.PILIH} WHERE entitas = :entitas AND entitas_id = :entitasId
        ORDER BY urutan, id`,
      { entitas, entitasId },
    );
    return baris.map((r) => this.ke(r));
  }

  async ambil(id: number): Promise<Lampiran | undefined> {
    const baris = await this.db.kueriSatu<Record<string, unknown>>(
      `${this.PILIH} WHERE id = :id`,
      { id },
    );
    return baris ? this.ke(baris) : undefined;
  }

  async simpan(masukan: {
    entitas: EntitasLampiran;
    entitasId: number;
    jenis: string;
    namaBerkas: string;
    lokasi: string;
    tipeMedia: string;
    ukuranBita: number;
    diunggahOleh: number;
  }): Promise<number> {
    return this.db.transaksi(async (koneksi) => {
      const hasil = await koneksi.execute<{ id: number[] }>(
        `
        INSERT INTO lampiran (entitas, entitas_id, jenis, nama_berkas, lokasi,
                              tipe_media, ukuran_bita, diunggah_oleh, urutan)
        VALUES (:entitas, :entitasId, :jenis, :namaBerkas, :lokasi,
                :tipeMedia, :ukuranBita, :diunggahOleh,
                (SELECT NVL(MAX(urutan), 0) + 1 FROM lampiran
                  WHERE entitas = :entitas AND entitas_id = :entitasId AND jenis = :jenis))
        RETURNING id INTO :id
        `,
        {
          ...masukan,
          id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        },
      );
      return Number(hasil.outBinds?.id?.[0]);
    });
  }

  async hapus(id: number): Promise<void> {
    await this.db.transaksi(async (koneksi) => {
      await koneksi.execute('DELETE FROM lampiran WHERE id = :id', { id });
    });
  }

  /** Apakah baris tujuan lampiran ada. Hanya entitas master data yang diperiksa. */
  async entitasAda(entitas: EntitasLampiran, entitasId: number): Promise<boolean> {
    const sql =
      entitas === 'ALAT'
        ? 'SELECT 1 AS ada FROM alat WHERE id = :id AND dihapus_pada IS NULL'
        : entitas === 'ALAT_SERTIFIKAT'
          ? 'SELECT 1 AS ada FROM alat_sertifikat WHERE id = :id'
          : null;
    if (!sql) return true;
    return !!(await this.db.kueriSatu(sql, { id: entitasId }));
  }

  /** Menaruh lampiran di urutan pertama di antara lampiran sejenis pada entitas yang sama. */
  async jadikanPertama(id: number): Promise<void> {
    await this.db.transaksi(async (koneksi) => {
      await koneksi.execute(
        `UPDATE lampiran l SET urutan = (
           SELECT NVL(MIN(x.urutan), 0) - 1 FROM lampiran x
            WHERE x.entitas = l.entitas AND x.entitas_id = l.entitas_id AND x.jenis = l.jenis)
          WHERE l.id = :id`,
        { id },
      );
    });
  }

  /** Menandai berkas yang barisnya ada tetapi fisiknya tidak ditemukan. */
  async tandaiHilang(id: number): Promise<void> {
    await this.db.transaksi(async (koneksi) => {
      await koneksi.execute('UPDATE lampiran SET berkas_hilang = 1 WHERE id = :id', { id });
    });
  }
}
