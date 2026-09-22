import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { KONFIGURASI, type Konfigurasi } from '../konfigurasi/konfigurasi';
import { buatTautan } from '../serah-terima/konfirmasi';
import { NotifikasiRepository } from './notifikasi.repository';
import { PENGIRIM_NOTIFIKASI, type PengirimNotifikasi } from './pengirim';
import {
  jenjangJatuhTempo,
  pengingatPengembalian,
  selisihHari,
  susunPesan,
} from './pengingat';

export interface HasilPemeriksaan {
  diperiksa: number;
  diantrekan: number;
  rincian: Array<{ entitas: string; entitasId: number; jenjang: string }>;
}

@Injectable()
export class NotifikasiService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(NotifikasiService.name);
  private pewaktu?: NodeJS.Timeout;

  constructor(
    private readonly repo: NotifikasiRepository,
    @Inject(PENGIRIM_NOTIFIKASI) private readonly pengirim: PengirimNotifikasi,
    @Inject(KONFIGURASI) private readonly konf: Konfigurasi,
  ) {}

  onModuleInit(): void {
    if (!this.konf.PENGINGAT_AKTIF) {
      this.log.log('Penjadwal pengingat tidak aktif (PENGINGAT_AKTIF=false)');
      return;
    }
    const jeda = this.konf.PENGINGAT_JEDA_MENIT * 60_000;
    this.pewaktu = setInterval(() => {
      void this.putaran().catch((galat: unknown) => {
        // Kegagalan penjadwal tidak boleh menjatuhkan aplikasi.
        this.log.error(`Putaran pengingat gagal: ${String(galat)}`);
      });
    }, jeda);
    // Membiarkan proses berhenti meski pewaktu masih terpasang.
    this.pewaktu.unref();
    this.log.log(`Penjadwal pengingat aktif, setiap ${this.konf.PENGINGAT_JEDA_MENIT} menit`);
  }

  onModuleDestroy(): void {
    if (this.pewaktu) clearInterval(this.pewaktu);
  }

  /** Satu putaran: memeriksa yang jatuh tempo, lalu mengirim yang mengantre. */
  async putaran(): Promise<{ pemeriksaan: HasilPemeriksaan; dikirim: number }> {
    const pemeriksaan = await this.periksa();
    const dikirim = await this.kirimAntrean();
    return { pemeriksaan, dikirim };
  }

  /**
   * Memeriksa apa yang sudah jatuh tempo dan mengantrekan pengingatnya.
   *
   * Pemeriksaan dan pengiriman sengaja dipisah: kalau pengiriman gagal, yang
   * sudah diantrekan tetap tercatat dan dicoba lagi pada putaran berikutnya.
   */
  async periksa(sekarang = new Date()): Promise<HasilPemeriksaan> {
    const rincian: HasilPemeriksaan['rincian'] = [];
    let diperiksa = 0;

    for (const calon of await this.repo.calonKonfirmasi()) {
      diperiksa += 1;
      const jenjang = jenjangJatuhTempo(calon.diserahkanPada, sekarang, calon.sudahDikirim);
      if (!jenjang) continue;

      const umurHari = selisihHari(calon.diserahkanPada, sekarang);
      const tautan =
        calon.penerimaId === null
          ? null
          : buatTautan(
              { serahTerimaId: calon.serahTerimaId, penerimaId: calon.penerimaId },
              this.konf.JWT_RAHASIA,
            );

      await this.repo.antrekan({
        penerimaId: calon.penerimaId,
        penerimaEmail: calon.penerimaEmail,
        kanal: 'SUREL',
        // Jenjang ditulis di perihal agar putaran berikutnya tahu mana yang
        // sudah pernah dikirim, tanpa tabel tambahan.
        perihal: `[${jenjang.jenjang}] ${jenjang.perihal}`,
        isi: susunPesan({
          jenjang: jenjang.jenjang,
          namaPenerima: calon.namaPenerima,
          jumlahAlat: calon.jumlahBelum,
          nomorPeminjaman: calon.peminjamanId,
          umurHari,
        }),
        tautan,
        entitas: 'SERAH_TERIMA',
        entitasId: calon.serahTerimaId,
      });

      rincian.push({
        entitas: 'SERAH_TERIMA',
        entitasId: calon.serahTerimaId,
        jenjang: jenjang.jenjang,
      });
    }

    for (const calon of await this.repo.calonPengembalian()) {
      diperiksa += 1;
      const jenjang = pengingatPengembalian(calon.tanggalSelesai, sekarang, calon.sudahDikirim);
      if (!jenjang) continue;

      await this.repo.antrekan({
        penerimaId: calon.penerimaId,
        penerimaEmail: calon.penerimaEmail,
        kanal: 'SUREL',
        perihal: `[${jenjang.jenjang}] ${jenjang.perihal}`,
        isi: susunPesan({
          jenjang: jenjang.jenjang,
          namaPenerima: calon.namaPenerima,
          jumlahAlat: calon.jumlahAlat,
          nomorPeminjaman: calon.peminjamanId,
          umurHari: 0,
        }),
        tautan: null,
        entitas: 'PEMINJAMAN',
        entitasId: calon.peminjamanId,
      });

      rincian.push({
        entitas: 'PEMINJAMAN',
        entitasId: calon.peminjamanId,
        jenjang: jenjang.jenjang,
      });
    }

    return { diperiksa, diantrekan: rincian.length, rincian };
  }

  async kirimAntrean(): Promise<number> {
    const antrean = await this.repo.siapKirim();
    let berhasil = 0;

    for (const n of antrean) {
      const id = Number(n.ID);
      try {
        await this.pengirim.kirim({
          penerimaEmail: (n.PENERIMA_EMAIL as string) ?? null,
          kanal: n.KANAL as string,
          perihal: n.PERIHAL as string,
          isi: n.ISI as string,
          tautan: (n.TAUTAN as string) ?? null,
        });
        await this.repo.tandaiTerkirim(id);
        berhasil += 1;
      } catch (galat) {
        // Kegagalan satu notifikasi tidak menghentikan sisanya.
        await this.repo.tandaiGagal(id, galat instanceof Error ? galat.message : String(galat));
      }
    }

    return berhasil;
  }

  ringkasan() {
    return this.repo.ringkasan();
  }
}
