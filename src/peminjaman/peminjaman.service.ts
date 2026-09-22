import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AlatRepository } from '../alat/alat.repository';
import { KeranjangRepository } from '../keranjang/keranjang.repository';
import type { Pengguna } from '../pengguna/pengguna.model';
import { rantaiUntuk, tentukanAlur, type KodeAlur } from './alur';
import { PeminjamanRepository } from './peminjaman.repository';
import { ringkasDugaanKembar, validasiPengajuan } from './validasi';

export interface PermintaanCheckout {
  pekerjaan: string;
  nomorWo: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  tujuan?: string | null;
  kontak?: string | null;
  ambilDiGudang?: boolean | undefined;
  /** Diisi pengguna setelah melihat peringatan pengajuan kembar. */
  abaikanDugaanKembar?: boolean | undefined;
}

export interface RingkasanSebelumKirim {
  jumlahAlat: number;
  alur: KodeAlur;
  namaAlur: string;
  akanMenyetujui: string[];
  peringatan: string[];
}

const NAMA_ALUR: Record<KodeAlur, string> = {
  DALAM_UNIT: 'Dalam unit',
  DALAM_UNIT_GUDANG: 'Dalam unit — ambil di gudang',
  ANTAR_UNIT: 'Antar unit / antar Area UJH',
  EKSTERNAL: 'PLN Group / eksternal',
};

const NAMA_TAHAP: Record<string, string> = {
  PENGELOLA: 'SP Tool / SPS',
  MANAJER: 'Manajer Tool',
  GM: 'GM / Pimpinan tertinggi',
};

@Injectable()
export class PeminjamanService {
  private readonly log = new Logger(PeminjamanService.name);

  constructor(
    private readonly repo: PeminjamanRepository,
    private readonly keranjang: KeranjangRepository,
    private readonly alat: AlatRepository,
  ) {}

  /**
   * Ringkasan yang ditampilkan sebelum tombol kirim (PRD F2): berapa alat,
   * jenis peminjaman yang terdeteksi, dan siapa saja yang akan menyetujui.
   *
   * Memakai perhitungan yang sama persis dengan checkout, sehingga yang dilihat
   * pengguna tidak pernah berbeda dari yang benar-benar terjadi.
   */
  async ringkasan(pengguna: Pengguna, ambilDiGudang = false): Promise<RingkasanSebelumKirim> {
    const isi = await this.keranjang.isi(pengguna.id);
    const alatIds = isi.map((i) => i.alatId);
    const unitAlat = await this.alat.unitPemilik(alatIds);

    const alur = tentukanAlur({
      unitPeminjamId: pengguna.unitId,
      unitAlatIds: alatIds.map((id) => unitAlat.get(id) ?? null),
      ambilDiGudang,
    });

    const peringatan: string[] = [];
    if (pengguna.unitId === null) {
      peringatan.push(
        'Unit Anda belum tercatat, sehingga pengajuan diperlakukan sebagai antar unit ' +
          'dan menuntut persetujuan Manajer. Lengkapi unit Anda agar alurnya tepat.',
      );
    }
    const tidakTersedia = isi.filter((i) => !i.tersedia);
    if (tidakTersedia.length) {
      peringatan.push(
        `Sedang dipakai peminjaman lain: ${tidakTersedia.map((i) => i.nama).join(', ')}`,
      );
    }
    const kembar = await this.repo.dugaanKembar(pengguna.id, alatIds);
    const pesanKembar = ringkasDugaanKembar(kembar);
    if (pesanKembar) peringatan.push(pesanKembar);

    return {
      jumlahAlat: isi.length,
      alur,
      namaAlur: NAMA_ALUR[alur],
      akanMenyetujui: rantaiUntuk(alur).map((t) => NAMA_TAHAP[t] ?? t),
      peringatan,
    };
  }

  async checkout(pengguna: Pengguna, permintaan: PermintaanCheckout): Promise<{ id: number }> {
    const isi = await this.keranjang.isi(pengguna.id);
    const alatIds = isi.map((i) => i.alatId);

    const pelanggaran = validasiPengajuan({
      pekerjaan: permintaan.pekerjaan,
      nomorWo: permintaan.nomorWo,
      tanggalMulai: permintaan.tanggalMulai,
      tanggalSelesai: permintaan.tanggalSelesai,
      alatIds,
    });
    if (pelanggaran.length) {
      throw new BadRequestException({
        code: 'PENGAJUAN_TIDAK_LENGKAP',
        message: 'Ada isian yang perlu dilengkapi sebelum pengajuan dikirim',
        details: pelanggaran,
      });
    }

    if (!permintaan.abaikanDugaanKembar) {
      const kembar = await this.repo.dugaanKembar(pengguna.id, alatIds);
      const pesan = ringkasDugaanKembar(kembar);
      if (pesan) {
        // Peringatan, bukan larangan: meminjam alat yang sama dua kali bisa sah.
        throw new BadRequestException({
          code: 'DUGAAN_PENGAJUAN_KEMBAR',
          message: pesan,
          details: kembar,
          petunjuk: 'Kirim ulang dengan abaikanDugaanKembar=true bila memang disengaja.',
        });
      }
    }

    const unitAlat = await this.alat.unitPemilik(alatIds);
    const alur = tentukanAlur({
      unitPeminjamId: pengguna.unitId,
      unitAlatIds: alatIds.map((id) => unitAlat.get(id) ?? null),
      ambilDiGudang: permintaan.ambilDiGudang ?? false,
    });

    const id = await this.repo.simpanPengajuan(
      {
        pekerjaan: permintaan.pekerjaan.trim(),
        unitId: pengguna.unitId,
        tanggalMulai: permintaan.tanggalMulai,
        tanggalSelesai: permintaan.tanggalSelesai,
        nomorWo: permintaan.nomorWo.trim(),
        tujuan: permintaan.tujuan?.trim() ?? null,
        kontak: permintaan.kontak?.trim() ?? null,
        peminjamId: pengguna.id,
        namaPeminjam: pengguna.nama,
        alur,
        rantai: rantaiUntuk(alur),
        alatIds,
      },
      // Keranjang dikosongkan di dalam transaksi yang sama: bila pengajuan
      // batal, keranjangnya kembali utuh.
      async (koneksi) => {
        await this.keranjang.kosongkan(pengguna.id, koneksi);
      },
    );

    this.log.log(`Pengajuan #${id} dibuat oleh ${pengguna.username ?? pengguna.email} (${alur})`);
    return { id };
  }
}
