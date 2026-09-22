import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { bacaKonfigurasi, KONFIGURASI, type Konfigurasi } from './konfigurasi/konfigurasi';
import { OracleService } from './basisdata/oracle.service';
import { PenggunaRepository } from './pengguna/pengguna.repository';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { AuthGuard } from './auth/auth.guard';
import {
  PENYEDIA_IDENTITAS,
  PenyediaDirektori,
  PenyediaLewati,
  type PenyediaIdentitas,
} from './auth/identitas';
import { KesehatanController } from './kesehatan/kesehatan.controller';
import { AlatController } from './alat/alat.controller';
import { AlatRepository } from './alat/alat.repository';
import { UsulanController } from './alat/usulan.controller';
import { UsulanRepository } from './alat/usulan.repository';
import { UsulanService } from './alat/usulan.service';
import { KeranjangController } from './keranjang/keranjang.controller';
import { KeranjangRepository } from './keranjang/keranjang.repository';
import { PeminjamanController } from './peminjaman/peminjaman.controller';
import { PeminjamanRepository } from './peminjaman/peminjaman.repository';
import { PeminjamanService } from './peminjaman/peminjaman.service';
import { ApprovalController } from './approval/approval.controller';
import { ApprovalRepository } from './approval/approval.repository';
import { ApprovalService } from './approval/approval.service';
import { SerahTerimaController } from './serah-terima/serah-terima.controller';
import { SerahTerimaRepository } from './serah-terima/serah-terima.repository';
import { SerahTerimaService } from './serah-terima/serah-terima.service';
import { PenilaianController } from './penilaian/penilaian.controller';
import { PenilaianRepository } from './penilaian/penilaian.repository';
import { LampiranController } from './lampiran/lampiran.controller';
import { LampiranRepository } from './lampiran/lampiran.repository';
import { LampiranService } from './lampiran/lampiran.service';
import { MasterController } from './master/master.controller';
import { MasterRepository } from './master/master.repository';
import { LaporanController } from './laporan/laporan.controller';
import { LaporanRepository } from './laporan/laporan.repository';
import { NotifikasiController } from './notifikasi/notifikasi.controller';
import { NotifikasiRepository } from './notifikasi/notifikasi.repository';
import { NotifikasiService } from './notifikasi/notifikasi.service';
import { PENGIRIM_NOTIFIKASI, PengirimPencatat } from './notifikasi/pengirim';
import { KuesionerController } from './kuesioner/kuesioner.controller';
import { KuesionerRepository } from './kuesioner/kuesioner.repository';
import { SertifikatController } from './sertifikat/sertifikat.controller';
import { SertifikatRepository } from './sertifikat/sertifikat.repository';
import { JadwalController } from './jadwal/jadwal.controller';
import { JadwalRepository } from './jadwal/jadwal.repository';

@Module({
  controllers: [
    AuthController,
    KesehatanController,
    AlatController,
    UsulanController,
    KeranjangController,
    PeminjamanController,
    ApprovalController,
    SerahTerimaController,
    PenilaianController,
    LampiranController,
    MasterController,
    LaporanController,
    NotifikasiController,
    KuesionerController,
    SertifikatController,
    JadwalController,
  ],
  providers: [
    { provide: KONFIGURASI, useFactory: () => bacaKonfigurasi() },
    OracleService,
    PenggunaRepository,
    AlatRepository,
    UsulanRepository,
    UsulanService,
    KeranjangRepository,
    PeminjamanRepository,
    PeminjamanService,
    ApprovalRepository,
    ApprovalService,
    SerahTerimaRepository,
    SerahTerimaService,
    PenilaianRepository,
    LampiranRepository,
    LampiranService,
    MasterRepository,
    LaporanRepository,
    NotifikasiRepository,
    KuesionerRepository,
    SertifikatRepository,
    JadwalRepository,
    NotifikasiService,
    { provide: PENGIRIM_NOTIFIKASI, useClass: PengirimPencatat },
    AuthService,
    {
      provide: PENYEDIA_IDENTITAS,
      inject: [KONFIGURASI],
      useFactory: (konf: Konfigurasi): PenyediaIdentitas =>
        konf.AUTH_LEWATI_DIREKTORI ? new PenyediaLewati() : new PenyediaDirektori(),
    },
    // Seluruh endpoint tertutup secara bawaan; yang publik ditandai @Publik().
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
