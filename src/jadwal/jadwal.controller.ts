import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { JadwalRepository } from './jadwal.repository';
import { ringkasJadwal } from './jadwal';

const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const MAKS_HARI = 366;

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

const skema = z.object({
  dari: z.string().trim().regex(TANGGAL).optional(),
  sampai: z.string().trim().regex(TANGGAL).optional(),
  unitId: z.coerce.number().int().positive().optional(),
  bidangId: z.coerce.number().int().positive().optional(),
  cari: z.string().trim().optional(),
  batasAlat: z.coerce.number().int().min(1).max(500).default(300),
});

const geser = (t: string, hari: number): string =>
  new Date(Date.parse(t) + hari * 86_400_000).toISOString().slice(0, 10);

/** Senin pada pekan tanggal tersebut; jendela bawaan dimulai dari sana. */
const senin = (t: string): string =>
  geser(t, -(((new Date(`${t}T00:00:00Z`).getUTCDay() + 6) % 7)));

@Controller('jadwal')
export class JadwalController {
  constructor(private readonly repo: JadwalRepository) {}

  /**
   * Jadwal pemakaian alat untuk dashboard.
   *
   * Tanpa tanggal, jendelanya delapan pekan mulai Senin pekan ini — sama dengan
   * bawaan di layar, supaya pemanggilan pertama tidak perlu menghitung apa pun.
   */
  @Get()
  async daftar(@Query() kueri: unknown) {
    const hasil = skema.safeParse(kueri);
    if (!hasil.success) {
      throw new BadRequestException({
        code: 'PERMINTAAN_TIDAK_SAH',
        message: 'Isian tidak lengkap',
        details: hasil.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      });
    }
    const p = hasil.data;
    const hariIni = new Date().toISOString().slice(0, 10);
    const dari = p.dari ?? senin(hariIni);
    let sampai = p.sampai ?? geser(dari, 55);
    if (sampai < dari) sampai = dari;
    if (Date.parse(sampai) - Date.parse(dari) > (MAKS_HARI - 1) * 86_400_000)
      sampai = geser(dari, MAKS_HARI - 1);

    const isi = await this.repo.perAlat(
      {
        dari,
        sampai,
        unitId: p.unitId,
        bidangId: p.bidangId,
        cari: p.cari,
        batasAlat: p.batasAlat,
      },
      hariIni,
    );

    return {
      dari,
      sampai,
      hariIni,
      jumlahAlat: isi.length,
      ringkasan: ringkasJadwal(isi),
      isi,
    };
  }

  /**
   * Jadwal lain yang bertumpuk dengan periode yang diminta, per alat.
   *
   * Dipakai dua tempat: saat peminjam menyusun pengajuan di katalog, dan saat
   * pengelola memutuskan. Keduanya hanya diberi peringatan — pengajuan yang
   * bertabrakan tetap boleh dikirim dan tetap boleh disetujui (keputusan
   * 2026-09-18); pengelola yang menimbang.
   */
  @Get('tabrakan')
  async tabrakan(@Query() kueri: unknown) {
    const p = uraikan(
      z.object({
        alatIds: z
          .string()
          .trim()
          .min(1)
          .transform((t) => t.split(',').map((x) => Number(x.trim())))
          .refine((a) => a.length > 0 && a.length <= 100 && a.every((x) => Number.isInteger(x) && x > 0), {
            message: 'alatIds berisi 1–100 nomor alat',
          }),
        mulai: z.string().trim().regex(TANGGAL),
        selesai: z.string().trim().regex(TANGGAL),
        kecualiPeminjamanId: z.coerce.number().int().positive().optional(),
      }),
      kueri,
    );
    if (p.selesai < p.mulai)
      throw new BadRequestException({
        code: 'PERIODE_TIDAK_SAH',
        message: 'Tanggal selesai mendahului tanggal mulai',
      });

    const isi = await this.repo.tabrakanUntuk(
      p.alatIds,
      p.mulai,
      p.selesai,
      p.kecualiPeminjamanId,
    );
    const perAlat = new Map<number, typeof isi>();
    for (const x of isi) {
      if (!perAlat.has(x.alatId)) perAlat.set(x.alatId, []);
      perAlat.get(x.alatId)!.push(x);
    }
    return {
      mulai: p.mulai,
      selesai: p.selesai,
      jumlahAlat: perAlat.size,
      isi: [...perAlat.entries()].map(([alatId, jadwal]) => ({ alatId, jadwal })),
    };
  }
}
