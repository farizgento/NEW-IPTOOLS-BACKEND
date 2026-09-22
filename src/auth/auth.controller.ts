import { BadRequestException, Body, Controller, Get, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { Publik, type PermintaanBerpengguna } from './auth.guard';

const skemaMasuk = z.object({
  username: z.string().min(1, 'username wajib diisi'),
  sandi: z.string().default(''),
});

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Publik()
  @Post('masuk')
  async masuk(@Body() badan: unknown) {
    const hasil = skemaMasuk.safeParse(badan);
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

    const { token, umurDetik, pengguna } = await this.auth.masuk(
      hasil.data.username,
      hasil.data.sandi,
    );

    return {
      token,
      umurDetik,
      pengguna: {
        id: pengguna.id,
        nama: pengguna.nama,
        email: pengguna.email,
        unitId: pengguna.unitId,
        namaUnit: pengguna.namaUnit,
        jabatan: pengguna.jabatan,
        peran: pengguna.peran,
        // Ditampilkan apa adanya supaya antarmuka dapat meminta pengguna
        // melengkapi unitnya sendiri saat masih kosong (PRD 6.2.1).
        sumberUnit: pengguna.sumberUnit,
      },
    };
  }

  /** Profil pemegang token. Menjadi cara termudah memastikan token dipakai. */
  @Get('saya')
  saya(@Req() permintaan: PermintaanBerpengguna) {
    const p = permintaan.pengguna!;
    return {
      id: p.id,
      nama: p.nama,
      email: p.email,
      username: p.username,
      nipeg: p.nipeg,
      unitId: p.unitId,
      namaUnit: p.namaUnit,
      jabatan: p.jabatan,
      sumberUnit: p.sumberUnit,
      peran: p.peran,
    };
  }
}
