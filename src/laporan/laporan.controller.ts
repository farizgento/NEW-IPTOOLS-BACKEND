import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { z } from 'zod';
import { LaporanRepository } from './laporan.repository';

const skemaTahun = z.object({
  tahun: z.coerce.number().int().min(2000).max(2100).default(new Date().getFullYear()),
  unitId: z.coerce.number().int().positive().optional(),
});

@Controller('laporan')
export class LaporanController {
  constructor(private readonly repo: LaporanRepository) {}

  /** Efektivitas alat: pemakaian setahun dibanding estimasinya. */
  @Get('efektivitas')
  async efektivitas(@Query() kueri: unknown) {
    const p = skemaTahun.parse(kueri);
    const isi = await this.repo.efektivitas(p.tahun, p.unitId);
    const hitung = (nilai: string) => isi.filter((r) => r.EFEKTIVITAS === nilai).length;
    return {
      tahun: p.tahun,
      ringkasan: {
        efektif: hitung('EFEKTIF'),
        tidakEfektif: hitung('TIDAK EFEKTIF'),
        tidakDiukur: hitung('TIDAK DIUKUR'),
      },
      isi,
    };
  }

  @Get('pemakaian-bulanan')
  async pemakaianBulanan(@Query() kueri: unknown) {
    const p = skemaTahun.parse(kueri);
    return { tahun: p.tahun, isi: await this.repo.pemakaianBulanan(p.tahun, p.unitId) };
  }

  @Get('alat/:id/riwayat')
  riwayat(@Param('id', ParseIntPipe) id: number) {
    return this.repo.rincianPemakaian(id);
  }

  @Get('dashboard')
  dashboard(@Query('unitId') unitId?: string) {
    const id = unitId ? Number(unitId) : undefined;
    return this.repo.dashboard(Number.isFinite(id) ? id : undefined);
  }
}
