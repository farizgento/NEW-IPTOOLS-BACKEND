import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { SertifikatRepository } from './sertifikat.repository';
import { periksaSertifikat, saranSetahun, type IsiSertifikat } from './sertifikat';
import { ButuhPeran } from '../auth/auth.guard';

const STATUS = ['LEWAT', 'SEGERA', 'BERLAKU', 'TANPA_TANGGAL', 'TANPA_BERKAS'] as const;

const skemaDaftar = z.object({
  cari: z.string().trim().optional(),
  unitId: z.coerce.number().int().positive().optional(),
  status: z.enum(STATUS).optional(),
  pelaksana: z.string().trim().optional(),
  halaman: z.coerce.number().int().min(1).default(1),
  perHalaman: z.coerce.number().int().min(1).max(100).default(20),
});

const skemaIsi = z.object({
  nomor: z.string().trim().min(1).max(255),
  tanggalKalibrasi: z.string().trim(),
  tanggalSaran: z.string().trim().nullable().optional(),
  hasil: z.string().trim().max(255).nullable().optional(),
  pelaksana: z.string().trim().max(255).nullable().optional(),
});

const skemaTambah = skemaIsi.extend({ alatId: z.coerce.number().int().positive() });

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

const hariIni = (): string => new Date().toISOString().slice(0, 10);

/**
 * Sertifikat kalibrasi alat.
 *
 * Membaca boleh oleh siapa saja yang sudah masuk — status kalibrasi menentukan
 * apakah peminjam perlu diberi tahu. Menulis hanya pengelola dan admin.
 */
@Controller('sertifikat')
export class SertifikatController {
  constructor(private readonly repo: SertifikatRepository) {}

  @Get()
  async daftar(@Query() kueri: unknown) {
    const p = uraikan(skemaDaftar, kueri);
    const kini = hariIni();
    const [halaman, ringkasan] = await Promise.all([
      this.repo.daftar(
        {
          cari: p.cari,
          unitId: p.unitId,
          status: p.status,
          pelaksana: p.pelaksana,
          halaman: p.halaman,
          perHalaman: p.perHalaman,
        },
        kini,
      ),
      this.repo.ringkasan(kini),
    ]);
    return { ...halaman, ringkasan };
  }

  @Get('pelaksana')
  pelaksana() {
    return this.repo.pelaksana();
  }

  @Get('alat/:alatId')
  async riwayat(@Param('alatId', ParseIntPipe) alatId: number) {
    if (!(await this.repo.alatAda(alatId)))
      throw new NotFoundException({ code: 'ALAT_TIDAK_ADA', message: 'Alat tidak ditemukan' });
    return { alatId, isi: await this.repo.riwayat(alatId, hariIni()) };
  }

  @Post()
  @ButuhPeran('PENGELOLA', 'ADMIN_UNIT', 'ADMIN_SUPER')
  async tambah(@Body() badan: unknown) {
    const p = uraikan(skemaTambah, badan);
    const kini = hariIni();
    if (!(await this.repo.alatAda(p.alatId)))
      throw new NotFoundException({ code: 'ALAT_TIDAK_ADA', message: 'Alat tidak ditemukan' });

    // Tanggal kalibrasi ulang biasanya setahun setelah kalibrasi; tetap boleh dikosongkan.
    const isi = rapikan(p, p.tanggalSaran === undefined ? saranSetahun(p.tanggalKalibrasi) : p.tanggalSaran ?? null);
    tolakBilaSalah(isi, kini);

    const id = await this.repo.tambah(p.alatId, isi, 0);
    return this.repo.satu(id, kini);
  }

  @Patch(':id')
  @ButuhPeran('PENGELOLA', 'ADMIN_UNIT', 'ADMIN_SUPER')
  async ubah(@Param('id', ParseIntPipe) id: number, @Body() badan: unknown) {
    const kini = hariIni();
    const lama = await this.repo.satu(id, kini);
    if (!lama)
      throw new NotFoundException({
        code: 'SERTIFIKAT_TIDAK_ADA',
        message: 'Sertifikat tidak ditemukan',
      });
    const p = uraikan(skemaIsi, badan);
    const isi = rapikan(p, p.tanggalSaran === undefined ? lama.tanggalSaran : p.tanggalSaran ?? null);
    tolakBilaSalah(isi, kini);

    await this.repo.ubah(id, isi);
    return this.repo.satu(id, kini);
  }
}

function rapikan(
  p: z.infer<typeof skemaIsi>,
  tanggalSaran: string | null,
): IsiSertifikat {
  return {
    nomor: p.nomor,
    tanggalKalibrasi: p.tanggalKalibrasi,
    tanggalSaran,
    hasil: p.hasil ?? null,
    pelaksana: p.pelaksana ?? null,
  };
}

function tolakBilaSalah(isi: IsiSertifikat, kini: string): void {
  const salah = periksaSertifikat(isi, kini);
  if (salah.length)
    throw new BadRequestException({
      code: 'SERTIFIKAT_TIDAK_SAH',
      message: 'Isian sertifikat belum benar',
      details: salah,
    });
}
