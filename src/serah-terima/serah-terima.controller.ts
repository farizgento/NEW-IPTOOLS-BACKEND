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
import { SerahTerimaService } from './serah-terima.service';
import { ButuhPeran, Publik, type PermintaanBerpengguna } from '../auth/auth.guard';

const skemaSiapkan = z.object({
  peminjamanId: z.coerce.number().int().positive(),
  arah: z.enum(['KIRIM', 'KEMBALI']).default('KIRIM'),
  ringkas: z.boolean().optional(),
  peminjamanAlatIds: z.array(z.coerce.number().int().positive()).min(1),
  nomorKendaraan: z.string().trim().optional().nullable(),
  jenisKendaraan: z.string().trim().optional().nullable(),
  pengemudi: z.string().trim().optional().nullable(),
});

const skemaKonfirmasi = z.object({
  metode: z.enum(['TAUTAN', 'KODE', 'TANDA_TANGAN', 'PETUGAS', 'PINDAI']),
  serahTerimaAlatIds: z.array(z.coerce.number().int().positive()).optional(),
  kode: z.string().trim().optional().nullable(),
  alasan: z.string().trim().optional().nullable(),
  tautan: z.string().trim().optional().nullable(),
  belumDiterima: z
    .array(z.object({ serahTerimaAlatId: z.coerce.number().int().positive(), alasan: z.string().trim().min(3).max(500) }))
    .optional(),
});

const skemaKonfirmasiTautan = skemaKonfirmasi.pick({ serahTerimaAlatIds: true, belumDiterima: true });

function uraikan<T>(skema: z.ZodType<T>, badan: unknown): T {
  const hasil = skema.safeParse(badan);
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
  return hasil.data;
}

@Controller('serah-terima')
export class SerahTerimaController {
  constructor(private readonly service: SerahTerimaService) {}

  /** F9 — daftar yang menunggu konfirmasi saya. */
  @Get('menunggu-saya')
  menunggu(@Req() permintaan: PermintaanBerpengguna) {
    return this.service.menungguKonfirmasi(permintaan.pengguna!);
  }

  /** Daftar kerja petugas gudang (F7 + F12). */
  @Get('antrean')
  @ButuhPeran('PENGELOLA', 'STAF')
  antrean(@Req() permintaan: PermintaanBerpengguna) {
    return this.service.antreanPetugas(permintaan.pengguna!);
  }

  /** Bahan layar penyiapan satu pengajuan (F7). */
  @Get('persiapan/:peminjamanId')
  @ButuhPeran('PENGELOLA', 'STAF')
  persiapan(@Param('peminjamanId', ParseIntPipe) peminjamanId: number, @Req() permintaan: PermintaanBerpengguna) {
    return this.service.persiapan(peminjamanId, permintaan.pengguna!);
  }

  /**
   * F8 jalur 1 — halaman tautan tanpa login.
   *
   * Satu-satunya pintu masuk tanpa sesi. Yang dapat dilihat dan dikonfirmasi
   * hanya serah terima yang tertulis di tautan bertanda tangan itu.
   */
  @Publik()
  @Get('tautan/:token')
  berkasTautan(@Param('token') token: string) {
    return this.service.berkasTautan(token);
  }

  @Publik()
  @Post('tautan/:token/konfirmasi')
  konfirmasiTautan(@Param('token') token: string, @Body() badan: unknown) {
    const p = uraikan(skemaKonfirmasiTautan, badan);
    return this.service.konfirmasiTautan(token, {
      ...(p.serahTerimaAlatIds ? { serahTerimaAlatIds: p.serahTerimaAlatIds } : {}),
      ...(p.belumDiterima ? { belumDiterima: p.belumDiterima } : {}),
    });
  }

  /** F7 — menyiapkan dokumen serah terima. */
  @Post()
  @ButuhPeran('PENGELOLA', 'STAF')
  siapkan(@Req() permintaan: PermintaanBerpengguna, @Body() badan: unknown) {
    const p = uraikan(skemaSiapkan, badan);
    return this.service.siapkan(permintaan.pengguna!, {
      peminjamanId: p.peminjamanId,
      arah: p.arah,
      ringkas: p.ringkas ?? false,
      peminjamanAlatIds: p.peminjamanAlatIds,
      nomorKendaraan: p.nomorKendaraan ?? null,
      jenisKendaraan: p.jenisKendaraan ?? null,
      pengemudi: p.pengemudi ?? null,
    });
  }

  @Get(':id')
  berkas(@Param('id', ParseIntPipe) id: number, @Req() permintaan: PermintaanBerpengguna) {
    return this.service.berkas(id, permintaan.pengguna!);
  }

  /** F7 — menyerahkan alat, status menjadi SENT. */
  @Post(':id/serahkan')
  @ButuhPeran('PENGELOLA', 'STAF')
  serahkan(@Param('id', ParseIntPipe) id: number, @Req() permintaan: PermintaanBerpengguna) {
    return this.service.serahkan(permintaan.pengguna!, id);
  }

  /** F8 + F9 — konfirmasi penerimaan lewat salah satu dari empat jalur. */
  @Post(':id/konfirmasi')
  konfirmasi(
    @Param('id', ParseIntPipe) id: number,
    @Req() permintaan: PermintaanBerpengguna,
    @Body() badan: unknown,
  ) {
    const p = uraikan(skemaKonfirmasi, badan);
    return this.service.konfirmasi(id, permintaan.pengguna!, {
      metode: p.metode,
      ...(p.serahTerimaAlatIds ? { serahTerimaAlatIds: p.serahTerimaAlatIds } : {}),
      kode: p.kode ?? null,
      alasan: p.alasan ?? null,
      tautan: p.tautan ?? null,
      ...(p.belumDiterima ? { belumDiterima: p.belumDiterima } : {}),
    });
  }
}
