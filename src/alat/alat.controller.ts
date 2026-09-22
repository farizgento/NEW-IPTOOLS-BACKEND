import { Controller, Get, NotFoundException, Param, ParseIntPipe, Query } from '@nestjs/common';
import { z } from 'zod';
import { AlatRepository } from './alat.repository';

const skemaKatalog = z.object({
  kelompok: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
  urut: z.enum(['nama', 'tersedia']).default('nama'),
  cari: z.string().trim().optional(),
  unitId: z.coerce.number().int().positive().optional(),
  bidangId: z.coerce.number().int().positive().optional(),
  hanyaTersedia: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  halaman: z.coerce.number().int().min(1).default(1),
  perHalaman: z.coerce.number().int().min(1).max(100).default(20),
});

@Controller('alat')
export class AlatController {
  constructor(private readonly repo: AlatRepository) {}

  @Get()
  async katalog(@Query() kueri: unknown) {
    const p = skemaKatalog.parse(kueri);
    return this.repo.katalog({
      kelompok: p.kelompok,
      urut: p.urut,
      cari: p.cari,
      unitId: p.unitId,
      bidangId: p.bidangId,
      hanyaTersedia: p.hanyaTersedia,
      halaman: p.halaman,
      perHalaman: p.perHalaman,
    });
  }

  /** Detail satu alat beserta aksesoris, berkas, dan sertifikat terakhirnya. */
  @Get(':id')
  async detail(@Param('id', ParseIntPipe) id: number) {
    const data = await this.repo.detail(id);
    if (!data)
      throw new NotFoundException({ code: 'ALAT_TIDAK_ADA', message: 'Alat tidak ditemukan' });
    return data;
  }
}
