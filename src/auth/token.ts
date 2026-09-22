import jwt from 'jsonwebtoken';
import type { Peran } from '../pengguna/pengguna.model';

/**
 * Isi token. Sengaja sedikit: yang berubah sering (nama, jabatan) dibaca dari
 * basis data, bukan dititipkan di token yang tidak bisa ditarik kembali.
 */
export interface IsiToken {
  /** id pengguna */
  sub: number;
  peran: Peran[];
  unitId: number | null;
}

export interface HasilVerifikasi {
  sah: boolean;
  isi?: IsiToken;
  alasan?: string;
}

export function terbitkanToken(isi: IsiToken, rahasia: string, umurDetik: number): string {
  return jwt.sign(isi, rahasia, { expiresIn: umurDetik, algorithm: 'HS256' });
}

/**
 * Memverifikasi token. Berbeda dari sistem lama yang menerbitkan token lalu
 * tidak pernah memeriksanya sama sekali (PRD 2.5), setiap permintaan melewati
 * fungsi ini.
 */
export function verifikasiToken(token: string, rahasia: string): HasilVerifikasi {
  try {
    const isi = jwt.verify(token, rahasia, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    if (typeof isi.sub !== 'number' && typeof isi.sub !== 'string') {
      return { sah: false, alasan: 'token tanpa pemilik' };
    }
    return {
      sah: true,
      isi: {
        sub: Number(isi.sub),
        peran: Array.isArray(isi.peran) ? (isi.peran as Peran[]) : [],
        unitId: typeof isi.unitId === 'number' ? isi.unitId : null,
      },
    };
  } catch (galat) {
    const pesan = galat instanceof Error ? galat.message : 'token tidak sah';
    return { sah: false, alasan: pesan };
  }
}

/** Mengambil token dari header Authorization. */
export function ambilTokenDariHeader(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [jenis, nilai] = header.split(' ');
  if (!jenis || !nilai) return undefined;
  if (jenis.toLowerCase() !== 'bearer') return undefined;
  return nilai.trim() || undefined;
}
