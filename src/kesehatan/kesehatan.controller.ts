import { Controller, Get } from '@nestjs/common';
import { OracleService } from '../basisdata/oracle.service';
import { PenggunaRepository } from '../pengguna/pengguna.repository';
import { Publik } from '../auth/auth.guard';

@Controller('kesehatan')
export class KesehatanController {
  constructor(
    private readonly db: OracleService,
    private readonly pengguna: PenggunaRepository,
  ) {}

  @Publik()
  @Get()
  async periksa() {
    const basisdata = await this.db.periksaKoneksi().catch(() => false);
    return { status: basisdata ? 'sehat' : 'basis data tidak terjangkau', basisdata };
  }

  /**
   * Kesiapan data pengguna. Selama akses kepegawaian belum ada, angka
   * "tanpaUnitBerperan" adalah pekerjaan yang harus selesai sebelum peluncuran
   * (PRD 6.2.1).
   */
  @Get('data-pengguna')
  async dataPengguna() {
    return this.pengguna.ringkasan();
  }
}
