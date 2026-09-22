import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { z } from 'zod';
import { PeminjamanService } from './peminjaman.service';
import { PeminjamanRepository } from './peminjaman.repository';
import type { PermintaanBerpengguna } from '../auth/auth.guard';

const skemaCheckout = z.object({
  pekerjaan: z.string().trim().min(1),
  nomorWo: z.string().trim().min(1),
  tanggalMulai: z.string().trim(),
  tanggalSelesai: z.string().trim(),
  tujuan: z.string().trim().optional().nullable(),
  kontak: z.string().trim().optional().nullable(),
  ambilDiGudang: z.boolean().optional(),
  abaikanDugaanKembar: z.boolean().optional(),
});

@Controller('peminjaman')
export class PeminjamanController {
  constructor(
    private readonly service: PeminjamanService,
    private readonly repo: PeminjamanRepository,
  ) {}

  /** Ringkasan sebelum tombol kirim: berapa alat, alur apa, siapa penyetujunya. */
  @Get('ringkasan')
  ringkasan(
    @Req() permintaan: PermintaanBerpengguna,
    @Query('ambilDiGudang') ambilDiGudang?: string,
  ) {
    return this.service.ringkasan(permintaan.pengguna!, ambilDiGudang === 'true');
  }

  @Get('saya')
  milikSaya(@Req() permintaan: PermintaanBerpengguna) {
    return this.repo.milikSaya(permintaan.pengguna!.id);
  }

  @Get(':id')
  async detail(@Param('id', ParseIntPipe) id: number) {
    const data = await this.repo.detail(id);
    if (!data) throw new NotFoundException(`Pengajuan #${id} tidak ditemukan`);
    return data;
  }

  @Post()
  async checkout(@Req() permintaan: PermintaanBerpengguna, @Body() badan: unknown) {
    const hasil = skemaCheckout.safeParse(badan);
    if (!hasil.success) {
      throw new BadRequestException({
        code: 'PERMINTAAN_TIDAK_SAH',
        message: 'Isian tidak lengkap',
        details: hasil.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    return this.service.checkout(permintaan.pengguna!, {
      ...hasil.data,
      tujuan: hasil.data.tujuan ?? null,
      kontak: hasil.data.kontak ?? null,
    });
  }
}
