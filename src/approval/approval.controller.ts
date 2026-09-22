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
import { ApprovalService } from './approval.service';
import { ButuhPeran, type PermintaanBerpengguna } from '../auth/auth.guard';

const skemaKeputusan = z.object({
  keputusan: z.enum(['SETUJU', 'TOLAK']),
  alasan: z.string().trim().optional().nullable(),
});

@Controller()
export class ApprovalController {
  constructor(private readonly service: ApprovalService) {}

  /**
   * Inbox "Tugas Saya" (PRD F4).
   *
   * Satu alamat untuk Pengelola, Manajer, dan GM. Yang membedakan isinya hanya
   * peran dan unit pengguna — bukan halaman yang ia buka.
   */
  @Get('tugas')
  @ButuhPeran('PENGELOLA', 'MANAJER', 'GM')
  antrean(@Req() permintaan: PermintaanBerpengguna) {
    return this.service.antrean(permintaan.pengguna!);
  }

  /** Layar keputusan (PRD F5). */
  @Get('peminjaman/:id/approval')
  @ButuhPeran('PENGELOLA', 'MANAJER', 'GM')
  berkas(@Param('id', ParseIntPipe) id: number, @Req() permintaan: PermintaanBerpengguna) {
    return this.service.berkas(id, permintaan.pengguna!);
  }

  @Post('peminjaman/:id/approval')
  @ButuhPeran('PENGELOLA', 'MANAJER', 'GM')
  async putuskan(
    @Param('id', ParseIntPipe) id: number,
    @Req() permintaan: PermintaanBerpengguna,
    @Body() badan: unknown,
  ) {
    const hasil = skemaKeputusan.safeParse(badan);
    if (!hasil.success) {
      throw new BadRequestException({
        code: 'PERMINTAAN_TIDAK_SAH',
        message: 'Keputusan harus SETUJU atau TOLAK',
        details: hasil.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    return this.service.putuskan(
      id,
      permintaan.pengguna!,
      hasil.data.keputusan,
      hasil.data.alasan ?? null,
    );
  }
}
