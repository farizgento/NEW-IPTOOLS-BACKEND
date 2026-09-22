import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Pengguna } from '../pengguna/pengguna.model';
import { UsulanRepository } from './usulan.repository';
import {
  bakukanIsiLama,
  bolehMengusulkan,
  normalNamaReferensi,
  periksaKeputusan,
  saringIsi,
  statusRiwayat,
  validasiUsulan,
  type BidangReferensi,
  type TindakanUsulan,
} from './usulan';

const TIPE_BIDANG: Record<string, BidangReferensi> = {
  JENIS_ALAT: 'jenisId',
  KONDISI_ALAT: 'kondisiId',
  LOKASI_ALAT: 'lokasiId',
};

@Injectable()
export class UsulanService {
  private readonly log = new Logger(UsulanService.name);

  constructor(private readonly repo: UsulanRepository) {}

  /** Menambah alat baru — langsung, seperti sistem lama (PRD 12.9). */
  async tambah(pengguna: Pengguna, masukan: Record<string, unknown>) {
    const isi = saringIsi(masukan);
    if (!String(isi.nama ?? '').trim()) {
      throw new BadRequestException({
        code: 'NAMA_WAJIB',
        message: 'Nama alat wajib diisi',
      });
    }
    const pelanggaran = validasiUsulan('UBAH', isi);
    if (pelanggaran.length) {
      throw new BadRequestException({
        code: 'ISIAN_TIDAK_SAH',
        message: 'Ada isian yang tidak sah',
        details: pelanggaran,
      });
    }
    const id = await this.repo.tambah(isi, pengguna.id);
    this.log.log(`Alat #${id} ditambahkan oleh ${pengguna.nama}`);
    return { id };
  }

  async usulkan(
    pengguna: Pengguna,
    alatId: number,
    tindakan: TindakanUsulan,
    masukan: Record<string, unknown>,
    keterangan: string | null,
  ) {
    const isi = tindakan === 'HAPUS' ? {} : saringIsi(masukan);

    const pelanggaran = validasiUsulan(tindakan, isi);
    if (pelanggaran.length) {
      throw new BadRequestException({
        code: 'USULAN_TIDAK_SAH',
        message: 'Usulan tidak dapat diterima',
        details: pelanggaran,
      });
    }

    const tertahan = bolehMengusulkan(await this.repo.jumlahMenunggu(alatId));
    if (tertahan) {
      throw new ConflictException({ code: 'USULAN_MENUNGGU', message: tertahan.message });
    }

    const id = await this.repo.buatUsulan({
      alatId,
      tindakan,
      isi,
      keterangan,
      oleh: pengguna.id,
      nama: pengguna.nama,
    });
    this.log.log(`Usulan #${id} (${tindakan}) atas alat #${alatId} oleh ${pengguna.nama}`);
    return { id, status: 'WAITING APPROVAL' };
  }

  /** Pencari id referensi dari nama, untuk usulan warisan sistem lama. */
  private async pencariReferensi() {
    const peta = new Map<string, number>();
    for (const r of await this.repo.referensiAlat()) {
      const kunci = `${TIPE_BIDANG[r.TIPE]}:${normalNamaReferensi(r.NAMA)}`;
      if (!peta.has(kunci)) peta.set(kunci, Number(r.ID));
    }
    return (bidang: BidangReferensi, nama: string) => peta.get(`${bidang}:${normalNamaReferensi(nama)}`);
  }

  async menunggu() {
    const [daftar, cari] = await Promise.all([this.repo.menunggu(), this.pencariReferensi()]);
    return daftar.map((u) => {
      const { isi, takTerpetakan } = bakukanIsiLama(u.isi, cari);
      return { ...u, isi, takTerpetakan };
    });
  }

  riwayat(alatId: number) {
    return this.repo.riwayat(alatId);
  }

  async putuskan(
    pengguna: Pengguna,
    usulanId: number,
    keputusan: 'SETUJU' | 'TOLAK',
    alasan: string | null,
  ) {
    const usulan = await this.repo.ambil(usulanId);
    if (!usulan) throw new NotFoundException(`Usulan #${usulanId} tidak ditemukan`);

    const izin = periksaKeputusan({
      statusSaatIni: usulan.status,
      keputusan,
      alasan,
      // Ditegakkan di server. Procedure lama menerima nama dan email pemutus
      // sebagai parameter lalu memakainya begitu saja.
      adalahPemutusSah: pengguna.peran.includes('ADMIN_SUPER'),
    });
    if (!izin.boleh) throw new ForbiddenException(izin.alasan);

    const { isi, takTerpetakan } = bakukanIsiLama(usulan.isi, await this.pencariReferensi());
    if (keputusan === 'SETUJU' && usulan.tindakan === 'UBAH' && takTerpetakan.length) {
      throw new BadRequestException({
        code: 'ISI_USULAN_TIDAK_DIKENAL',
        message: `Usulan tidak dapat diterapkan: ${takTerpetakan.join(', ')} tidak ada di data referensi. Tolak usulan ini atau tambahkan referensinya dulu.`,
      });
    }

    const status = statusRiwayat(keputusan);
    await this.repo.putuskan({
      usulanId,
      alatId: usulan.alatId,
      tindakan: usulan.tindakan,
      isi,
      status,
      keterangan: alasan?.trim() ?? null,
      oleh: pengguna.id,
      nama: pengguna.nama,
    });

    this.log.log(`Usulan #${usulanId} ${status} oleh ${pengguna.nama}`);
    return { id: usulanId, status };
  }
}
