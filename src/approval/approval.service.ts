import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Pengguna } from '../pengguna/pengguna.model';
import type { TahapApproval } from '../peminjaman/alur';
import { ApprovalRepository, type ItemAntrean } from './approval.repository';
import {
  ALASAN_SIAP_PAKAI,
  bolehMemutuskan,
  periksaAlasan,
  statusSetelahKeputusan,
  PERAN_TAHAP,
} from './keputusan';

export interface Antrean {
  jumlah: number;
  isi: Array<ItemAntrean & { penanda: 'biasa' | 'tertunda' | 'terlambat' }>;
}

@Injectable()
export class ApprovalService {
  private readonly log = new Logger(ApprovalService.name);

  constructor(private readonly repo: ApprovalRepository) {}

  /** Tahap yang boleh diputuskan seseorang, diturunkan dari perannya. */
  private tahapUntuk(pengguna: Pengguna): TahapApproval[] {
    return (Object.keys(PERAN_TAHAP) as TahapApproval[]).filter((tahap) =>
      PERAN_TAHAP[tahap].some((peran) => pengguna.peran.includes(peran)),
    );
  }

  async antrean(pengguna: Pengguna): Promise<Antrean> {
    const tahap = this.tahapUntuk(pengguna);
    if (!tahap.length || pengguna.unitId === null) {
      // Unit belum tercatat berarti antrean tidak dapat dibatasi lingkupnya.
      // Menampilkan seluruh unit akan salah; menampilkan kosong jujur adanya.
      return { jumlah: 0, isi: [] };
    }

    const isi = await this.repo.antrean(tahap, pengguna.unitId);
    return {
      jumlah: isi.length,
      isi: isi.map((item) => ({
        ...item,
        // Umur menunggu ditandai supaya yang tertinggal tidak tenggelam.
        penanda: item.umurHari > 7 ? 'terlambat' : item.umurHari > 3 ? 'tertunda' : 'biasa',
      })),
    };
  }

  async berkas(peminjamanId: number, pengguna: Pengguna) {
    const berkas = await this.repo.berkas(peminjamanId);
    if (!berkas.pengajuan) throw new NotFoundException(`Pengajuan #${peminjamanId} tidak ditemukan`);

    const rantai = await this.repo.rantai(peminjamanId);
    const status = String(berkas.pengajuan.STATUS ?? '');
    const izin = bolehMemutuskan(rantai, pengguna.peran, status);

    return {
      ...berkas,
      dapatDiputuskan: izin.boleh,
      alasanTidakDapat: izin.boleh ? null : izin.alasan,
      tahapBerjalan: izin.boleh ? izin.baris.tahap : null,
      alasanSiapPakai: ALASAN_SIAP_PAKAI,
    };
  }

  async putuskan(
    peminjamanId: number,
    pengguna: Pengguna,
    keputusan: 'SETUJU' | 'TOLAK',
    alasan: string | null,
  ): Promise<{ status: string; tahap: TahapApproval }> {
    const berkas = await this.repo.berkas(peminjamanId);
    if (!berkas.pengajuan) throw new NotFoundException(`Pengajuan #${peminjamanId} tidak ditemukan`);

    const statusLama = String(berkas.pengajuan.STATUS ?? '');
    const rantai = await this.repo.rantai(peminjamanId);

    const izin = bolehMemutuskan(rantai, pengguna.peran, statusLama);
    if (!izin.boleh) throw new ForbiddenException(izin.alasan);

    // Alasan penolakan ditegakkan di server, bukan hanya di antarmuka.
    const keluhan = periksaAlasan(keputusan, alasan);
    if (keluhan) {
      throw new BadRequestException({
        code: 'ALASAN_WAJIB',
        message: keluhan,
        details: { alasanSiapPakai: ALASAN_SIAP_PAKAI },
      });
    }

    const statusBaru = statusSetelahKeputusan(rantai, izin.baris.tahap, keputusan);

    await this.repo.simpanKeputusan({
      peminjamanId,
      urutan: izin.baris.urutan,
      keputusan,
      alasan: alasan?.trim() ?? null,
      statusBaru,
      statusLama,
      penyetujuId: pengguna.id,
      namaPenyetuju: pengguna.nama,
      keterangan:
        keputusan === 'TOLAK'
          ? `Ditolak pada tahap ${izin.baris.tahap}: ${alasan?.trim()}`
          : `Disetujui pada tahap ${izin.baris.tahap}`,
    });

    this.log.log(
      `Pengajuan #${peminjamanId} ${keputusan} pada tahap ${izin.baris.tahap} ` +
        `oleh ${pengguna.username ?? pengguna.email} → ${statusBaru}`,
    );

    return { status: statusBaru, tahap: izin.baris.tahap };
  }
}
