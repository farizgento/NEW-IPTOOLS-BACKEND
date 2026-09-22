import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import oracledb from 'oracledb';
import { KONFIGURASI, type Konfigurasi } from '../konfigurasi/konfigurasi';

export type Baris = Record<string, unknown>;

/**
 * Nilai yang diikatkan ke kueri. Selalu berupa objek bernama, tidak pernah
 * rangkaian teks SQL — inilah yang menutup celah penyisipan.
 */
export type Ikatan = Record<string, unknown>;

/**
 * Satu-satunya pintu ke basis data.
 *
 * SQL ditulis tangan, bukan lewat ORM: skema sudah ditetapkan di db/schema dan
 * tidak boleh diselaraskan otomatis oleh alat apa pun (PRD 5.2).
 */
@Injectable()
export class OracleService implements OnModuleInit, OnModuleDestroy {
  private pool?: oracledb.Pool;

  constructor(@Inject(KONFIGURASI) private readonly konf: Konfigurasi) {}

  async onModuleInit(): Promise<void> {
    // Mode thin: tidak memerlukan Oracle Instant Client terpasang.
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
    oracledb.fetchAsString = [oracledb.CLOB];

    this.pool = await oracledb.createPool({
      user: this.konf.DB_USER,
      password: this.konf.DB_PASSWORD,
      connectString: `${this.konf.DB_HOST}:${this.konf.DB_PORT}/${this.konf.DB_SERVICE}`,
      poolMin: this.konf.DB_POOL_MIN,
      poolMax: this.konf.DB_POOL_MAX,
      poolIncrement: 1,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.close(10);
  }

  private ambilPool(): oracledb.Pool {
    if (!this.pool) throw new Error('Kolam koneksi belum siap');
    return this.pool;
  }

  /** Kueri baca. Selalu memakai bind parameter, tidak pernah merangkai teks SQL. */
  async kueri<T extends Baris = Baris>(
    sql: string,
    ikatan: Ikatan = {},
  ): Promise<T[]> {
    const koneksi = await this.ambilPool().getConnection();
    try {
      const hasil = await koneksi.execute<T>(sql, ikatan as oracledb.BindParameters);
      return hasil.rows ?? [];
    } finally {
      await koneksi.close();
    }
  }

  async kueriSatu<T extends Baris = Baris>(
    sql: string,
    ikatan: Ikatan = {},
  ): Promise<T | undefined> {
    const baris = await this.kueri<T>(sql, ikatan);
    return baris[0];
  }

  /**
   * Menjalankan serangkaian perintah dalam satu transaksi.
   *
   * Satu tindakan bisnis = satu transaksi. Prosedur lama sering COMMIT di
   * tengah jalan lalu gagal sesudahnya, dan itulah asal pengajuan duplikat
   * (PRD 2.5). Di sini commit hanya terjadi bila seluruh isi fungsi selesai.
   */
  async transaksi<T>(kerja: (koneksi: oracledb.Connection) => Promise<T>): Promise<T> {
    const koneksi = await this.ambilPool().getConnection();
    try {
      const hasil = await kerja(koneksi);
      await koneksi.commit();
      return hasil;
    } catch (galat) {
      await koneksi.rollback();
      throw galat;
    } finally {
      await koneksi.close();
    }
  }

  /** Dipakai pemeriksaan kesehatan; sengaja sesederhana mungkin. */
  async periksaKoneksi(): Promise<boolean> {
    const baris = await this.kueriSatu<{ HASIL: number }>('SELECT 1 AS hasil FROM dual');
    return baris?.HASIL === 1;
  }
}
