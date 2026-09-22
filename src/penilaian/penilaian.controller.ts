import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { z } from 'zod';
import { PenilaianRepository } from './penilaian.repository';
import { ButuhPeran, type PermintaanBerpengguna } from '../auth/auth.guard';
import {
  kondisiBaikLengkap,
  pilihanKondisiBaik,
  validasiPenilaian,
  type TahapPenilaian,
} from './penilaian';

const TAHAP = ['BOOKED', 'SENT', 'RETURN', 'FINISH', 'KERUSAKAN'] as const;

const skemaSimpan = z.object({
  tahap: z.enum(TAHAP),
  /** Jalur satu tindakan: seluruh alat dinyatakan kondisi baik. */
  semuaBaik: z.boolean().optional(),
  penilaian: z
    .array(
      z.object({
        peminjamanAlatId: z.coerce.number().int().positive(),
        pilihanIds: z.array(z.coerce.number().int().positive()),
        keterangan: z.record(z.string(), z.string()).optional(),
      }),
    )
    .optional(),
});

@Controller('penilaian')
export class PenilaianController {
  constructor(private readonly repo: PenilaianRepository) {}

  /** Daftar pilihan kondisi, beserta pilihan bawaan "kondisi baik". */
  @Get('katalog')
  async katalog() {
    const semua = await this.repo.katalog();
    return {
      pilihan: semua,
      kondisiBaik: pilihanKondisiBaik(semua),
      lengkap: kondisiBaikLengkap(semua),
    };
  }

  @Get('peminjaman/:id')
  async alat(
    @Param('id', ParseIntPipe) id: number,
    @Query('tahap') tahap: string = 'SENT',
  ) {
    const t = (TAHAP as readonly string[]).includes(tahap) ? (tahap as TahapPenilaian) : 'SENT';
    return {
      tahap: t,
      alat: await this.repo.alatPengajuan(id, t),
      ringkasan: await this.repo.ringkasan(id, t),
    };
  }

  @Post('peminjaman/:id')
  // Penilaian kondisi diisi petugas, baik saat mengirim maupun saat menerima
  // kembali; peminjam tidak menilai (PRD F7, F11).
  @ButuhPeran('PENGELOLA', 'STAF')
  async simpan(
    @Param('id', ParseIntPipe) id: number,
    @Req() permintaan: PermintaanBerpengguna,
    @Body() badan: unknown,
  ) {
    const hasil = skemaSimpan.safeParse(badan);
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

    const katalog = await this.repo.katalog();
    const peta = new Map(katalog.map((k) => [k.id, k]));

    let penilaian = hasil.data.penilaian ?? [];

    if (hasil.data.semuaBaik) {
      // Satu tindakan untuk seluruh alat: kelima kategori diisi pilihan
      // bernilai 100, tanpa satu pun keterangan (PRD F6).
      if (!kondisiBaikLengkap(katalog)) {
        throw new BadRequestException({
          code: 'KATALOG_TIDAK_LENGKAP',
          message: 'Ada grup kategori tanpa pilihan kondisi penuh — hubungi admin',
        });
      }
      const bawaan = pilihanKondisiBaik(katalog).map((p) => p.id);
      const alat = await this.repo.alatPengajuan(id, hasil.data.tahap);
      penilaian = alat.map((a) => ({
        peminjamanAlatId: Number(a.PEMINJAMAN_ALAT_ID),
        pilihanIds: bawaan,
      }));
    }

    if (!penilaian.length) {
      throw new BadRequestException({
        code: 'PENILAIAN_KOSONG',
        message: 'Tidak ada alat yang dinilai',
      });
    }

    const pelanggaran = penilaian.flatMap((p) =>
      validasiPenilaian(p, peta).map((x) => ({
        ...x,
        peminjamanAlatId: p.peminjamanAlatId,
      })),
    );
    if (pelanggaran.length) {
      throw new BadRequestException({
        code: 'PENILAIAN_TIDAK_LENGKAP',
        message: 'Ada kategori yang belum dinilai atau keterangannya belum diisi',
        details: pelanggaran,
      });
    }

    const disimpan = await this.repo.simpan({
      tahap: hasil.data.tahap,
      penilaian,
      oleh: permintaan.pengguna!.id,
      nama: permintaan.pengguna!.nama,
    });

    return {
      ...disimpan,
      tahap: hasil.data.tahap,
      ringkasan: await this.repo.ringkasan(id, hasil.data.tahap),
    };
  }
}
