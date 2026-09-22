import { mkdir, unlink, writeFile, stat } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { KONFIGURASI, type Konfigurasi } from '../konfigurasi/konfigurasi';
import type { Pengguna } from '../pengguna/pengguna.model';
import { LampiranRepository, type Lampiran } from './lampiran.repository';
import {
  akhiranCocok,
  bersihkanNamaAsli,
  isiCocok,
  lokasiRelatif,
  namaSimpan,
  periksaTujuan,
  validasiBerkas,
  type EntitasLampiran,
} from './berkas';

export interface BerkasUnggah {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class LampiranService {
  private readonly log = new Logger(LampiranService.name);

  constructor(
    private readonly repo: LampiranRepository,
    @Inject(KONFIGURASI) private readonly konf: Konfigurasi,
  ) {}

  private akar(): string {
    return resolve(this.konf.LAMPIRAN_DIREKTORI);
  }

  /**
   * Menyusun lokasi berkas dan memastikan hasilnya tetap di dalam direktori
   * penyimpanan.
   *
   * Pemeriksaan ini berlapis dengan `namaSimpan` yang sudah membuang nama dari
   * pengunggah: kalau kelak ada jalur lain yang memasok nama, berkas tetap
   * tidak bisa keluar dari direktorinya.
   */
  private lokasiPenuh(relatif: string): string {
    const akar = this.akar();
    const penuh = resolve(akar, normalize(relatif));
    if (penuh !== akar && !penuh.startsWith(akar + sep)) {
      throw new BadRequestException({
        code: 'LOKASI_TIDAK_SAH',
        message: 'Lokasi berkas keluar dari direktori penyimpanan',
      });
    }
    return penuh;
  }

  /** Menolak pengguna tanpa hak atas berkas master data alat. */
  private pastikanBoleh(entitas: EntitasLampiran, jenis: string, tipeMedia: string | null, pengguna: Pengguna) {
    const tolak = periksaTujuan(entitas, jenis, tipeMedia, pengguna.peran);
    if (!tolak) return;
    if (tolak.kode === 'PERAN') throw new ForbiddenException({ code: 'BUKAN_WEWENANG', message: tolak.pesan });
    throw new BadRequestException({ code: 'BERKAS_DITOLAK', message: tolak.pesan });
  }

  async unggah(
    pengguna: Pengguna,
    entitas: EntitasLampiran,
    entitasId: number,
    jenis: string,
    berkas: BerkasUnggah,
  ): Promise<Lampiran> {
    this.pastikanBoleh(entitas, jenis, berkas.mimetype, pengguna);
    if (!(await this.repo.entitasAda(entitas, entitasId))) {
      throw new NotFoundException({ code: 'TUJUAN_TIDAK_ADA', message: `${entitas} #${entitasId} tidak ditemukan` });
    }

    const pelanggaran = validasiBerkas(
      {
        namaAsli: berkas.originalname,
        tipeMedia: berkas.mimetype,
        ukuran: berkas.size,
      },
      this.konf.LAMPIRAN_MAKS_BITA,
    );

    if (!akhiranCocok(berkas.originalname, berkas.mimetype)) {
      pelanggaran.push({
        field: 'berkas',
        message: 'Akhiran nama berkas tidak sesuai dengan tipe isinya',
      });
    }

    if (!pelanggaran.length && !isiCocok(berkas.buffer.subarray(0, 16), berkas.mimetype)) {
      pelanggaran.push({ field: 'berkas', message: 'Isi berkas tidak sesuai dengan tipenya' });
    }

    if (pelanggaran.length) {
      throw new BadRequestException({
        code: 'BERKAS_DITOLAK',
        message: 'Berkas tidak dapat diterima',
        details: pelanggaran,
      });
    }

    const nama = namaSimpan(berkas.mimetype);
    const relatif = lokasiRelatif(entitas, entitasId, nama);
    const penuh = this.lokasiPenuh(relatif);

    await mkdir(dirname(penuh), { recursive: true });
    await writeFile(penuh, berkas.buffer);

    try {
      const id = await this.repo.simpan({
        entitas,
        entitasId,
        jenis,
        namaBerkas: bersihkanNamaAsli(berkas.originalname),
        lokasi: relatif,
        tipeMedia: berkas.mimetype,
        ukuranBita: berkas.size,
        diunggahOleh: pengguna.id,
      });

      this.log.log(`Lampiran #${id} (${entitas}/${entitasId}) diunggah oleh ${pengguna.nama}`);
      const tersimpan = await this.repo.ambil(id);
      return tersimpan!;
    } catch (galat) {
      // Baris gagal disimpan: berkasnya ikut dibuang agar tidak menjadi sampah
      // yang tidak tercatat di mana pun.
      await unlink(penuh).catch(() => undefined);
      throw galat;
    }
  }

  async daftar(entitas: EntitasLampiran, entitasId: number): Promise<Lampiran[]> {
    return this.repo.daftar(entitas, entitasId);
  }

  /**
   * Menyiapkan berkas untuk diunduh.
   *
   * Baris hasil migrasi hanya memuat nama berkas tanpa lokasi — berkas fisiknya
   * ada di penyimpanan sistem lama. Baris seperti itu ditandai, bukan
   * dilaporkan sebagai kesalahan tak dikenal.
   */
  async berkasUntukUnduh(id: number): Promise<{ lampiran: Lampiran; lokasiPenuh: string }> {
    const lampiran = await this.repo.ambil(id);
    if (!lampiran) throw new NotFoundException(`Lampiran #${id} tidak ditemukan`);

    if (!lampiran.lokasi) {
      throw new NotFoundException({
        code: 'BERKAS_SISTEM_LAMA',
        message:
          'Berkas ini tercatat pada sistem lama dan fisiknya belum dipindahkan. ' +
          `Nama berkasnya: ${lampiran.namaBerkas}`,
      });
    }

    const penuh = this.lokasiPenuh(lampiran.lokasi);
    try {
      await stat(penuh);
    } catch {
      await this.repo.tandaiHilang(id);
      throw new NotFoundException({
        code: 'BERKAS_HILANG',
        message: 'Berkas tercatat tetapi tidak ditemukan di penyimpanan',
      });
    }

    return { lampiran, lokasiPenuh: penuh };
  }

  async hapus(pengguna: Pengguna, id: number): Promise<void> {
    const lampiran = await this.repo.ambil(id);
    if (!lampiran) throw new NotFoundException(`Lampiran #${id} tidak ditemukan`);
    // Hanya wewenang yang diperiksa: jenis lama hasil migrasi tetap boleh dihapus.
    if (periksaTujuan(lampiran.entitas, lampiran.jenis, null, pengguna.peran)?.kode === 'PERAN') {
      this.pastikanBoleh(lampiran.entitas, lampiran.jenis, null, pengguna);
    }

    await this.repo.hapus(id);
    if (lampiran.lokasi) {
      await unlink(this.lokasiPenuh(lampiran.lokasi)).catch(() => undefined);
    }
  }

  /** Menjadikan sebuah foto alat sebagai foto utama (yang tampil di katalog). */
  async jadikanUtama(pengguna: Pengguna, id: number): Promise<Lampiran> {
    const lampiran = await this.repo.ambil(id);
    if (!lampiran) throw new NotFoundException(`Lampiran #${id} tidak ditemukan`);
    if (lampiran.entitas !== 'ALAT' || lampiran.jenis !== 'GAMBAR') {
      throw new BadRequestException({ code: 'BUKAN_FOTO_ALAT', message: 'Hanya foto alat yang dapat dijadikan foto utama' });
    }
    this.pastikanBoleh(lampiran.entitas, lampiran.jenis, null, pengguna);
    await this.repo.jadikanPertama(id);
    return (await this.repo.ambil(id))!;
  }

  /** Dipakai saat menyalakan aplikasi, agar kegagalan izin tulis segera terlihat. */
  async siapkanDirektori(): Promise<void> {
    await mkdir(join(this.akar()), { recursive: true });
  }
}
