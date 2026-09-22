import {
  BadRequestException,
  Body,
  ConflictException,
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
import { MasterRepository, TIPE_REFERENSI, type TipeReferensi } from './master.repository';
import { ButuhPeran } from '../auth/auth.guard';
import { AMBANG_MIRIP, miripProyek, periksaProyek, type IsiProyek } from './proyek';

const tipeSkema = z.enum(TIPE_REFERENSI as unknown as [TipeReferensi, ...TipeReferensi[]]);

const skemaUnit = z.object({
  nama: z.string().trim().min(1).max(255),
  kodeRe: z.coerce.number().int().nullable().optional(),
  kodeMaximo: z.string().trim().max(60).nullable().optional(),
  deskripsi: z.string().trim().max(255).nullable().optional(),
});

const skemaProyek = z.object({
  nama: z.string().trim().min(1).max(255),
  tanggalMulai: z.string().trim().nullable().optional(),
  tanggalSelesai: z.string().trim().nullable().optional(),
  site: z.string().trim().max(255).nullable().optional(),
  tipeOhId: z.coerce.number().int().positive().nullable().optional(),
});

const isiProyek = (p: z.infer<typeof skemaProyek>): IsiProyek => ({
  nama: p.nama,
  tanggalMulai: p.tanggalMulai ?? null,
  tanggalSelesai: p.tanggalSelesai ?? null,
  site: p.site ?? null,
  tipeOhId: p.tipeOhId ?? null,
});

const namaKembar = (apa: string) =>
  new ConflictException({
    code: 'NAMA_SUDAH_ADA',
    message: `${apa} dengan nama itu sudah terdaftar`,
  });

function tolakProyekSalah(isi: IsiProyek): void {
  const salah = periksaProyek(isi);
  if (salah.length)
    throw new BadRequestException({
      code: 'PROYEK_TIDAK_SAH',
      message: 'Isian proyek belum benar',
      details: salah,
    });
}

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

@Controller('master')
export class MasterController {
  constructor(private readonly repo: MasterRepository) {}

  /** Daftar kerja kesiapan data — halaman muka master data. */
  @Get('kesiapan')
  @ButuhPeran('ADMIN_UNIT', 'ADMIN_SUPER')
  kesiapan() {
    return this.repo.kesiapan();
  }

  @Get('unit')
  unit(@Query('termasukNonaktif') termasukNonaktif?: string) {
    return this.repo.unit(termasukNonaktif === 'true');
  }

  @Post('unit')
  @ButuhPeran('ADMIN_SUPER')
  async tambahUnit(@Body() badan: unknown) {
    const p = uraikan(skemaUnit, badan);
    if (await this.repo.unitBernamaSama(p.nama)) throw namaKembar('Unit');
    const id = await this.repo.tambahUnit({
      nama: p.nama,
      kodeRe: p.kodeRe ?? null,
      kodeMaximo: p.kodeMaximo ?? null,
      deskripsi: p.deskripsi ?? null,
    });
    return this.repo.unitSatu(id);
  }

  @Patch('unit/:id')
  @ButuhPeran('ADMIN_SUPER')
  async ubahUnit(@Param('id', ParseIntPipe) id: number, @Body() badan: unknown) {
    if (!(await this.repo.unitSatu(id)))
      throw new NotFoundException({ code: 'UNIT_TIDAK_ADA', message: 'Unit tidak ditemukan' });
    const p = uraikan(skemaUnit.extend({ nonaktif: z.boolean().default(false) }), badan);
    if (await this.repo.unitBernamaSama(p.nama, id)) throw namaKembar('Unit');
    await this.repo.ubahUnit(id, {
      nama: p.nama,
      kodeRe: p.kodeRe ?? null,
      kodeMaximo: p.kodeMaximo ?? null,
      deskripsi: p.deskripsi ?? null,
      nonaktif: p.nonaktif,
    });
    return this.repo.unitSatu(id);
  }

  /** Daftar proyek/pekerjaan yang muncul sebagai pilihan saat mengajukan. */
  @Get('proyek')
  proyek(@Query() kueri: unknown) {
    const p = uraikan(
      z.object({
        cari: z.string().trim().optional(),
        tanpaTipeOh: z
          .enum(['true', 'false'])
          .optional()
          .transform((v) => v === 'true'),
        halaman: z.coerce.number().int().min(1).default(1),
        perHalaman: z.coerce.number().int().min(1).max(100).default(20),
      }),
      kueri,
    );
    return this.repo.proyek(p);
  }

  @Post('proyek')
  @ButuhPeran('ADMIN_UNIT', 'ADMIN_SUPER')
  async tambahProyek(@Body() badan: unknown) {
    const isi = isiProyek(uraikan(skemaProyek, badan));
    tolakProyekSalah(isi);
    if (await this.repo.proyekBernamaSama(isi.nama)) throw namaKembar('Proyek');
    const id = await this.repo.tambahProyek(isi);
    return this.repo.proyekSatu(id);
  }

  @Patch('proyek/:id')
  @ButuhPeran('ADMIN_UNIT', 'ADMIN_SUPER')
  async ubahProyek(@Param('id', ParseIntPipe) id: number, @Body() badan: unknown) {
    if (!(await this.repo.proyekSatu(id)))
      throw new NotFoundException({ code: 'PROYEK_TIDAK_ADA', message: 'Proyek tidak ditemukan' });
    const isi = isiProyek(uraikan(skemaProyek, badan));
    tolakProyekSalah(isi);
    if (await this.repo.proyekBernamaSama(isi.nama, id)) throw namaKembar('Proyek');
    await this.repo.ubahProyek(id, isi);
    return this.repo.proyekSatu(id);
  }

  /**
   * Nama pekerjaan yang diketik bebas dan belum terdaftar, beserta saran proyek
   * yang mungkin sama. Saran tetap saran: penggabungan keputusan admin.
   */
  @Get('pekerjaan-lepas')
  @ButuhPeran('ADMIN_UNIT', 'ADMIN_SUPER')
  async pekerjaanLepas(@Query() kueri: unknown) {
    const p = uraikan(
      z.object({ batas: z.coerce.number().int().min(1).max(200).default(40) }),
      kueri,
    );
    const [baris, jumlah, daftarProyek] = await Promise.all([
      this.repo.pekerjaanLepas(p.batas),
      this.repo.jumlahPekerjaanLepas(),
      this.repo.proyek({ halaman: 1, perHalaman: 100 }),
    ]);
    const proyek = daftarProyek.isi as unknown as { ID: number; NAMA: string }[];
    const isi = (baris as unknown as { NAMA: string; JUMLAH: number; TERAKHIR: string | null }[]).map(
      (b) => {
        const saran = proyek
          .map((x) => ({ id: x.ID, nama: x.NAMA, nilai: miripProyek(b.NAMA, x.NAMA) }))
          .filter((x) => x.nilai >= AMBANG_MIRIP)
          .sort((a, b2) => b2.nilai - a.nilai)[0];
        return {
          nama: b.NAMA,
          jumlah: Number(b.JUMLAH),
          terakhir: b.TERAKHIR,
          saran: saran ? { id: saran.id, nama: saran.nama } : null,
        };
      },
    );
    return { jumlah, isi };
  }

  @Get('bidang')
  bidang() {
    return this.repo.bidang();
  }

  @Get('referensi/:tipe')
  referensi(@Param('tipe') tipe: string) {
    return this.repo.referensi(uraikan(tipeSkema, tipe));
  }

  @Post('referensi/:tipe')
  @ButuhPeran('ADMIN_SUPER')
  async tambah(@Param('tipe') tipe: string, @Body() badan: unknown) {
    const p = uraikan(
      z.object({ kode: z.string().trim().min(1).max(60), nama: z.string().trim().min(1).max(255) }),
      badan,
    );
    await this.repo.tambahReferensi(uraikan(tipeSkema, tipe), p.kode, p.nama);
    return this.repo.referensi(uraikan(tipeSkema, tipe));
  }

  @Patch('referensi/:id')
  @ButuhPeran('ADMIN_SUPER')
  async ubah(@Param('id', ParseIntPipe) id: number, @Body() badan: unknown) {
    const p = uraikan(
      z.object({ nama: z.string().trim().min(1).max(255), aktif: z.boolean().default(true) }),
      badan,
    );
    await this.repo.ubahReferensi(id, p.nama, p.aktif);
    return { diubah: id };
  }

  /**
   * Menggabungkan dua pilihan yang sebenarnya sama.
   *
   * Migrasi mendaftarkan 38 nilai apa adanya karena dipakai data lama tanpa
   * pernah terdaftar. Sebagian di antaranya ejaan berbeda dari hal yang sama,
   * dan inilah cara merapikannya tanpa kehilangan kaitan alat.
   */
  @Post('referensi/:id/gabung')
  @ButuhPeran('ADMIN_SUPER')
  async gabung(@Param('id', ParseIntPipe) id: number, @Body() badan: unknown) {
    const p = uraikan(z.object({ keId: z.coerce.number().int().positive() }), badan);
    if (p.keId === id) {
      throw new BadRequestException({
        code: 'GABUNG_KE_DIRI_SENDIRI',
        message: 'Pilihan tidak dapat digabungkan ke dirinya sendiri',
      });
    }
    const dialihkan = await this.repo.gabungReferensi(id, p.keId);
    return { dari: id, ke: p.keId, alatDialihkan: dialihkan };
  }

  /** Layar "Pengguna tanpa unit" (PRD 6.2.1). */
  @Get('pengguna-tanpa-unit')
  @ButuhPeran('ADMIN_UNIT', 'ADMIN_SUPER')
  async penggunaTanpaUnit(@Query('hanyaBerperan') hanyaBerperan?: string) {
    const isi = await this.repo.penggunaTanpaUnit(hanyaBerperan !== 'false');
    return { jumlah: isi.length, isi };
  }

  @Patch('pengguna/:id/unit')
  @ButuhPeran('ADMIN_UNIT', 'ADMIN_SUPER')
  async tetapkanUnit(@Param('id', ParseIntPipe) id: number, @Body() badan: unknown) {
    const p = uraikan(z.object({ unitId: z.coerce.number().int().positive() }), badan);
    // Asal nilai dicatat agar penyelarasan kepegawaian kelak dapat menimpanya
    // dengan benar, dan selisihnya dilaporkan (PRD 6.2.1).
    await this.repo.tetapkanUnit(id, p.unitId, 'ADMIN');
    return { penggunaId: id, unitId: p.unitId, sumberUnit: 'ADMIN' };
  }
}
