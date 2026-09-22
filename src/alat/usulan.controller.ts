import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
} from '@nestjs/common';
import { z } from 'zod';
import { UsulanService } from './usulan.service';
import { ButuhPeran, type PermintaanBerpengguna } from '../auth/auth.guard';

const skemaUsulan = z.object({
  tindakan: z.enum(['UBAH', 'HAPUS']),
  isi: z.record(z.string(), z.unknown()).default({}),
  keterangan: z.string().trim().max(2000).optional().nullable(),
});

const skemaKeputusan = z.object({
  keputusan: z.enum(['SETUJU', 'TOLAK']),
  alasan: z.string().trim().max(2000).optional().nullable(),
});

function uraikan<T>(skema: z.ZodType<T>, nilai: unknown): T {
  const hasil = skema.safeParse(nilai);
  if (!hasil.success) {
    throw new BadRequestException({
      code: 'PERMINTAAN_TIDAK_SAH',
      message: 'Isian tidak lengkap',
      details: hasil.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
  return hasil.data;
}

/**
 * Master data alat (PRD F13).
 *
 * Rutenya diletakkan di bawah /alat-master agar tidak bertabrakan dengan
 * katalog peminjaman di /alat, yang dipakai seluruh pengguna.
 */
@Controller('alat-master')
export class UsulanController {
  constructor(private readonly service: UsulanService) {}

  @Post()
  @ButuhPeran('PENGELOLA', 'ADMIN_UNIT', 'ADMIN_SUPER')
  tambah(@Req() permintaan: PermintaanBerpengguna, @Body() badan: unknown) {
    return this.service.tambah(
      permintaan.pengguna!,
      uraikan(z.record(z.string(), z.unknown()), badan),
    );
  }

  @Post(':id/usulan')
  @ButuhPeran('PENGELOLA', 'ADMIN_UNIT', 'ADMIN_SUPER')
  usulkan(
    @Param('id', ParseIntPipe) id: number,
    @Req() permintaan: PermintaanBerpengguna,
    @Body() badan: unknown,
  ) {
    const p = uraikan(skemaUsulan, badan);
    return this.service.usulkan(permintaan.pengguna!, id, p.tindakan, p.isi, p.keterangan ?? null);
  }

  @Get(':id/riwayat')
  riwayat(@Param('id', ParseIntPipe) id: number) {
    return this.service.riwayat(id);
  }

  @Get('usulan/menunggu')
  @ButuhPeran('ADMIN_SUPER')
  async menunggu() {
    const isi = await this.service.menunggu();
    return { jumlah: isi.length, isi };
  }

  @Post('usulan/:id/keputusan')
  @ButuhPeran('ADMIN_SUPER')
  putuskan(
    @Param('id', ParseIntPipe) id: number,
    @Req() permintaan: PermintaanBerpengguna,
    @Body() badan: unknown,
  ) {
    const p = uraikan(skemaKeputusan, badan);
    return this.service.putuskan(permintaan.pengguna!, id, p.keputusan, p.alasan ?? null);
  }
}
