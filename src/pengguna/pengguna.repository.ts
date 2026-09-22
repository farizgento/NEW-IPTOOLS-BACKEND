import { Injectable } from '@nestjs/common';
import { OracleService } from '../basisdata/oracle.service';
import { kePengguna, type BarisPengguna, type Pengguna } from './pengguna.model';

const PILIH = `
  SELECT p.id                AS id,
         p.nama              AS nama,
         p.email             AS email,
         p.username          AS username,
         p.nipeg             AS nipeg,
         p.unit_id           AS unit_id,
         u.nama              AS nama_unit,
         p.jabatan           AS jabatan,
         p.sumber_unit       AS sumber_unit,
         p.duplikat_dari     AS duplikat_dari,
         p.nonaktif_pada     AS nonaktif_pada,
         (SELECT LISTAGG(r.peran, ',') WITHIN GROUP (ORDER BY r.peran)
            FROM pengguna_peran r
           WHERE r.pengguna_id = p.id) AS peran
    FROM pengguna p
    LEFT JOIN unit u ON u.id = p.unit_id
`;

@Injectable()
export class PenggunaRepository {
  constructor(private readonly db: OracleService) {}

  async cariLewatUsername(username: string): Promise<Pengguna | undefined> {
    const baris = await this.db.kueriSatu<BarisPengguna>(
      `${PILIH} WHERE LOWER(p.username) = LOWER(:username) AND p.duplikat_dari IS NULL`,
      { username },
    );
    return baris ? kePengguna(baris) : undefined;
  }

  async cariLewatEmail(email: string): Promise<Pengguna | undefined> {
    const baris = await this.db.kueriSatu<BarisPengguna>(
      `${PILIH} WHERE LOWER(p.email) = LOWER(:email) AND p.duplikat_dari IS NULL`,
      { email },
    );
    return baris ? kePengguna(baris) : undefined;
  }

  async cariLewatId(id: number): Promise<Pengguna | undefined> {
    const baris = await this.db.kueriSatu<BarisPengguna>(`${PILIH} WHERE p.id = :id`, { id });
    return baris ? kePengguna(baris) : undefined;
  }

  async catatLogin(id: number): Promise<void> {
    await this.db.transaksi(async (koneksi) => {
      await koneksi.execute(
        'UPDATE pengguna SET login_terakhir = SYSTIMESTAMP WHERE id = :id',
        { id },
      );
    });
  }

  /**
   * Ringkasan kesiapan data pengguna — dipakai layar "Pengguna tanpa unit"
   * (PRD 6.2.1) dan pemeriksaan kesehatan.
   */
  async ringkasan(): Promise<{
    aktif: number;
    ganda: number;
    tanpaUnit: number;
    tanpaUnitBerperan: number;
  }> {
    const baris = await this.db.kueriSatu<{
      AKTIF: number;
      GANDA: number;
      TANPA_UNIT: number;
      TANPA_UNIT_BERPERAN: number;
    }>(`
      SELECT
        COUNT(CASE WHEN duplikat_dari IS NULL THEN 1 END) AS aktif,
        COUNT(CASE WHEN duplikat_dari IS NOT NULL THEN 1 END) AS ganda,
        COUNT(CASE WHEN duplikat_dari IS NULL AND unit_id IS NULL THEN 1 END) AS tanpa_unit,
        COUNT(CASE WHEN duplikat_dari IS NULL AND unit_id IS NULL
                    AND EXISTS (SELECT 1 FROM pengguna_peran r WHERE r.pengguna_id = p.id)
                   THEN 1 END) AS tanpa_unit_berperan
      FROM pengguna p
    `);
    return {
      aktif: Number(baris?.AKTIF ?? 0),
      ganda: Number(baris?.GANDA ?? 0),
      tanpaUnit: Number(baris?.TANPA_UNIT ?? 0),
      tanpaUnitBerperan: Number(baris?.TANPA_UNIT_BERPERAN ?? 0),
    };
  }
}
