import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { KONFIGURASI, type Konfigurasi } from '../konfigurasi/konfigurasi';
import { PenggunaRepository } from '../pengguna/pengguna.repository';
import { punyaSalahSatuPeran, type Peran, type Pengguna } from '../pengguna/pengguna.model';
import { ambilTokenDariHeader, verifikasiToken } from './token';

/** Menandai endpoint yang boleh diakses tanpa token. */
export const TANPA_TOKEN = 'tanpa_token';
export const Publik = () => SetMetadata(TANPA_TOKEN, true);

/** Membatasi endpoint pada pemegang salah satu peran. */
export const PERAN_DIMINTA = 'peran_diminta';
export const ButuhPeran = (...peran: Peran[]) => SetMetadata(PERAN_DIMINTA, peran);

export interface PermintaanBerpengguna extends Request {
  pengguna?: Pengguna;
}

/**
 * Penjaga bawaan seluruh aplikasi: tertutup kecuali ditandai Publik (PRD 5.4).
 *
 * Peran dibaca ulang dari basis data pada setiap permintaan, bukan dipercaya
 * apa adanya dari token. Dengan begitu pencabutan peran langsung berlaku, dan
 * peran tidak bisa dipalsukan lewat cookie seperti pada sistem lama.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly pengguna: PenggunaRepository,
    @Inject(KONFIGURASI) private readonly konf: Konfigurasi,
  ) {}

  async canActivate(konteks: ExecutionContext): Promise<boolean> {
    const publik = this.reflector.getAllAndOverride<boolean>(TANPA_TOKEN, [
      konteks.getHandler(),
      konteks.getClass(),
    ]);
    if (publik) return true;

    const permintaan = konteks.switchToHttp().getRequest<PermintaanBerpengguna>();
    const token = ambilTokenDariHeader(permintaan.headers.authorization);
    if (!token) throw new UnauthorizedException('Token tidak disertakan');

    const hasil = verifikasiToken(token, this.konf.JWT_RAHASIA);
    if (!hasil.sah || !hasil.isi) {
      throw new UnauthorizedException(`Token ditolak: ${hasil.alasan ?? 'tidak sah'}`);
    }

    const pengguna = await this.pengguna.cariLewatId(hasil.isi.sub);
    if (!pengguna) throw new UnauthorizedException('Pengguna tidak ditemukan');
    if (!pengguna.aktif) throw new UnauthorizedException('Akun tidak aktif');

    permintaan.pengguna = pengguna;

    const diminta = this.reflector.getAllAndOverride<Peran[]>(PERAN_DIMINTA, [
      konteks.getHandler(),
      konteks.getClass(),
    ]);
    if (diminta?.length && !punyaSalahSatuPeran(pengguna, diminta)) {
      throw new ForbiddenException(
        `Tindakan ini menuntut peran: ${diminta.join(', ')}`,
      );
    }

    return true;
  }
}
