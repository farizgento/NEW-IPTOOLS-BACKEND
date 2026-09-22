import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { z } from 'zod';
import { LampiranService, type BerkasUnggah } from './lampiran.service';
import { ButuhPeran, type PermintaanBerpengguna } from '../auth/auth.guard';
import { ENTITAS, type EntitasLampiran } from './berkas';

const skemaTujuan = z.object({
  entitas: z.enum(ENTITAS as [EntitasLampiran, ...EntitasLampiran[]]),
  entitasId: z.coerce.number().int().positive(),
  jenis: z.string().trim().min(1).max(40),
});

@Controller('lampiran')
export class LampiranController {
  constructor(private readonly service: LampiranService) {}

  @Get()
  async daftar(@Query() kueri: unknown) {
    const p = z
      .object({
        entitas: z.enum(ENTITAS as [EntitasLampiran, ...EntitasLampiran[]]),
        entitasId: z.coerce.number().int().positive(),
      })
      .parse(kueri);
    const isi = await this.service.daftar(p.entitas, p.entitasId);
    return { jumlah: isi.length, isi };
  }

  @Post()
  @UseInterceptors(FileInterceptor('berkas'))
  async unggah(
    @Req() permintaan: PermintaanBerpengguna,
    @UploadedFile() berkas: BerkasUnggah | undefined,
    @Query() kueri: unknown,
  ) {
    if (!berkas) {
      throw new BadRequestException({
        code: 'BERKAS_TIDAK_ADA',
        message: 'Sertakan berkas pada bidang bernama "berkas"',
      });
    }
    const hasil = skemaTujuan.safeParse(kueri);
    if (!hasil.success) {
      throw new BadRequestException({
        code: 'TUJUAN_TIDAK_SAH',
        message: 'Sebutkan entitas, entitasId, dan jenis lampiran',
        details: hasil.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    return this.service.unggah(
      permintaan.pengguna!,
      hasil.data.entitas,
      hasil.data.entitasId,
      hasil.data.jenis.toUpperCase(),
      berkas,
    );
  }

  @Get(':id/berkas')
  async unduh(@Param('id', ParseIntPipe) id: number, @Res() tanggapan: Response) {
    const { lampiran, lokasiPenuh } = await this.service.berkasUntukUnduh(id);

    // Berkas selalu diunduh, tidak pernah dijalankan peramban: yang tersimpan
    // memang hanya gambar dan PDF, tetapi menyatakannya eksplisit menutup
    // kemungkinan berkas dipakai menjalankan skrip di peramban penerima.
    tanggapan.setHeader('Content-Type', lampiran.tipeMedia ?? 'application/octet-stream');
    tanggapan.setHeader('X-Content-Type-Options', 'nosniff');
    tanggapan.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    tanggapan.download(lokasiPenuh, lampiran.namaBerkas);
  }

  @Delete(':id')
  @ButuhPeran('PENGELOLA', 'STAF', 'ADMIN_UNIT', 'ADMIN_SUPER')
  async hapus(@Req() permintaan: PermintaanBerpengguna, @Param('id', ParseIntPipe) id: number) {
    await this.service.hapus(permintaan.pengguna!, id);
    return { dihapus: id };
  }

  @Patch(':id/utama')
  @ButuhPeran('PENGELOLA', 'ADMIN_UNIT', 'ADMIN_SUPER')
  jadikanUtama(@Req() permintaan: PermintaanBerpengguna, @Param('id', ParseIntPipe) id: number) {
    return this.service.jadikanUtama(permintaan.pengguna!, id);
  }
}
