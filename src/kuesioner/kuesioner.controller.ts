import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { z } from 'zod';
import { KuesionerRepository } from './kuesioner.repository';
import { ButuhPeran, type PermintaanBerpengguna } from '../auth/auth.guard';
import { rekapIpa, validasiJawaban } from './kuesioner';

const teks = z.string().trim().max(500).optional().nullable();

const skemaSesi = z.object({
  peminjamanId: z.coerce.number().int().positive().optional().nullable(),
  namaPerusahaan: teks,
  namaUnit: teks,
  jenjangJabatan: teks,
  bidangPekerjaan: teks,
  unitOh: teks,
  jenisInspeksi: teks,
});

const skemaJawaban = z.object({
  jawaban: z
    .array(
      z.object({
        pertanyaanId: z.coerce.number().int().positive(),
        kepentingan: z.union([z.number(), z.string()]).optional().nullable(),
        kinerja: z.union([z.number(), z.string()]).optional().nullable(),
        teks: z.string().max(2000).optional().nullable(),
      }),
    )
    .min(1),
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

/** Kuesioner kepuasan (PRD F14). */
@Controller('kuesioner')
export class KuesionerController {
  constructor(private readonly repo: KuesionerRepository) {}

  @Get('pertanyaan')
  pertanyaan() {
    return this.repo.pertanyaanAktif();
  }

  @Post()
  async buat(@Req() permintaan: PermintaanBerpengguna, @Body() badan: unknown) {
    const p = uraikan(skemaSesi, badan);
    const pengguna = permintaan.pengguna!;
    const id = await this.repo.buat({
      peminjamanId: p.peminjamanId ?? null,
      namaPerusahaan: p.namaPerusahaan ?? null,
      namaUnit: p.namaUnit ?? pengguna.namaUnit,
      jenjangJabatan: p.jenjangJabatan ?? null,
      bidangPekerjaan: p.bidangPekerjaan ?? null,
      unitOh: p.unitOh ?? null,
      jenisInspeksi: p.jenisInspeksi ?? null,
      pengisiId: pengguna.id,
      namaPengisi: pengguna.nama,
    });
    return { id, status: 'DRAFT' };
  }

  @Get('rekap')
  @ButuhPeran('ADMIN_UNIT', 'ADMIN_SUPER', 'MANAJER')
  async rekap() {
    const [pertanyaan, baris, masukan] = await Promise.all([
      this.repo.pertanyaanAktif(),
      this.repo.barisRekap(),
      this.repo.masukanTeks(),
    ]);
    const nama = new Map(pertanyaan.map((p) => [p.id, p]));
    return {
      penilaian: rekapIpa(baris).map((r) => ({
        ...r,
        kategori: nama.get(r.pertanyaanId)?.kategori ?? null,
        pertanyaan: nama.get(r.pertanyaanId)?.pertanyaan ?? null,
      })),
      kritikDanSaran: masukan,
    };
  }

  @Get(':id')
  async ambil(@Param('id', ParseIntPipe) id: number) {
    const hasil = await this.repo.ambil(id);
    if (!hasil) throw new NotFoundException(`Kuesioner #${id} tidak ditemukan`);
    return hasil;
  }

  @Put(':id/jawaban')
  async jawab(
    @Param('id', ParseIntPipe) id: number,
    @Req() permintaan: PermintaanBerpengguna,
    @Body() badan: unknown,
  ) {
    const sesi = await this.repo.ambil(id);
    if (!sesi) throw new NotFoundException(`Kuesioner #${id} tidak ditemukan`);

    const pengguna = permintaan.pengguna!;
    if (Number(sesi.sesi.PENGISI_ID) !== pengguna.id) {
      throw new ForbiddenException('Kuesioner ini milik pengisi lain');
    }

    const p = uraikan(skemaJawaban, badan);
    const pertanyaan = await this.repo.pertanyaanAktif();
    const pelanggaran = validasiJawaban(pertanyaan, p.jawaban);
    if (pelanggaran.length) {
      throw new BadRequestException({
        code: 'JAWABAN_TIDAK_SAH',
        message: 'Ada jawaban yang perlu dibetulkan',
        details: pelanggaran,
      });
    }

    const hasil = await this.repo.simpanJawaban({
      kuesionerId: id,
      pertanyaan,
      jawaban: p.jawaban,
      penjawabId: pengguna.id,
      email: pengguna.email,
    });

    return {
      ...hasil,
      catatan:
        hasil.status === 'SUBMIT'
          ? 'Terima kasih, kuesioner lengkap.'
          : `Tersimpan. ${hasil.jumlahPertanyaan - hasil.terjawab} pertanyaan belum dijawab.`,
    };
  }
}
