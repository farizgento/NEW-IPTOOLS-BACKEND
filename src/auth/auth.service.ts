import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { KONFIGURASI, type Konfigurasi } from '../konfigurasi/konfigurasi';
import { PenggunaRepository } from '../pengguna/pengguna.repository';
import { bolehMasuk, type Pengguna } from '../pengguna/pengguna.model';
import { PENYEDIA_IDENTITAS, type PenyediaIdentitas } from './identitas';
import { terbitkanToken } from './token';

export interface HasilMasuk {
  token: string;
  umurDetik: number;
  pengguna: Pengguna;
}

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);

  constructor(
    private readonly repo: PenggunaRepository,
    @Inject(PENYEDIA_IDENTITAS) private readonly identitas: PenyediaIdentitas,
    @Inject(KONFIGURASI) private readonly konf: Konfigurasi,
  ) {}

  async masuk(username: string, sandi: string): Promise<HasilMasuk> {
    const sah = await this.identitas.periksa(username, sandi);
    if (!sah) throw new UnauthorizedException('Username atau sandi salah');

    // Username adalah kunci utama pencarian; email dipakai sebagai cadangan
    // karena sebagian baris lama tidak punya username (23 dari 611).
    const pengguna =
      (await this.repo.cariLewatUsername(username)) ?? (await this.repo.cariLewatEmail(username));

    if (!pengguna) {
      // Pesannya sengaja sama dengan sandi salah, agar tidak memberi tahu
      // penyerang username mana yang terdaftar.
      this.log.warn(`Masuk ditolak: "${username}" tidak ada di tabel pengguna`);
      throw new UnauthorizedException('Username atau sandi salah');
    }
    if (!bolehMasuk(pengguna)) {
      throw new UnauthorizedException('Akun tidak aktif');
    }

    await this.repo.catatLogin(pengguna.id);

    const token = terbitkanToken(
      { sub: pengguna.id, peran: pengguna.peran, unitId: pengguna.unitId },
      this.konf.JWT_RAHASIA,
      this.konf.JWT_UMUR_DETIK,
    );

    return { token, umurDetik: this.konf.JWT_UMUR_DETIK, pengguna };
  }
}
