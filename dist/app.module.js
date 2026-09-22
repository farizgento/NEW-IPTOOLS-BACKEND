"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const konfigurasi_1 = require("./konfigurasi/konfigurasi");
const oracle_service_1 = require("./basisdata/oracle.service");
const pengguna_repository_1 = require("./pengguna/pengguna.repository");
const auth_controller_1 = require("./auth/auth.controller");
const auth_service_1 = require("./auth/auth.service");
const auth_guard_1 = require("./auth/auth.guard");
const identitas_1 = require("./auth/identitas");
const kesehatan_controller_1 = require("./kesehatan/kesehatan.controller");
const alat_controller_1 = require("./alat/alat.controller");
const alat_repository_1 = require("./alat/alat.repository");
const usulan_controller_1 = require("./alat/usulan.controller");
const usulan_repository_1 = require("./alat/usulan.repository");
const usulan_service_1 = require("./alat/usulan.service");
const keranjang_controller_1 = require("./keranjang/keranjang.controller");
const keranjang_repository_1 = require("./keranjang/keranjang.repository");
const peminjaman_controller_1 = require("./peminjaman/peminjaman.controller");
const peminjaman_repository_1 = require("./peminjaman/peminjaman.repository");
const peminjaman_service_1 = require("./peminjaman/peminjaman.service");
const approval_controller_1 = require("./approval/approval.controller");
const approval_repository_1 = require("./approval/approval.repository");
const approval_service_1 = require("./approval/approval.service");
const serah_terima_controller_1 = require("./serah-terima/serah-terima.controller");
const serah_terima_repository_1 = require("./serah-terima/serah-terima.repository");
const serah_terima_service_1 = require("./serah-terima/serah-terima.service");
const penilaian_controller_1 = require("./penilaian/penilaian.controller");
const penilaian_repository_1 = require("./penilaian/penilaian.repository");
const lampiran_controller_1 = require("./lampiran/lampiran.controller");
const lampiran_repository_1 = require("./lampiran/lampiran.repository");
const lampiran_service_1 = require("./lampiran/lampiran.service");
const master_controller_1 = require("./master/master.controller");
const master_repository_1 = require("./master/master.repository");
const laporan_controller_1 = require("./laporan/laporan.controller");
const laporan_repository_1 = require("./laporan/laporan.repository");
const notifikasi_controller_1 = require("./notifikasi/notifikasi.controller");
const notifikasi_repository_1 = require("./notifikasi/notifikasi.repository");
const notifikasi_service_1 = require("./notifikasi/notifikasi.service");
const pengirim_1 = require("./notifikasi/pengirim");
const kuesioner_controller_1 = require("./kuesioner/kuesioner.controller");
const kuesioner_repository_1 = require("./kuesioner/kuesioner.repository");
const sertifikat_controller_1 = require("./sertifikat/sertifikat.controller");
const sertifikat_repository_1 = require("./sertifikat/sertifikat.repository");
const jadwal_controller_1 = require("./jadwal/jadwal.controller");
const jadwal_repository_1 = require("./jadwal/jadwal.repository");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        controllers: [
            auth_controller_1.AuthController,
            kesehatan_controller_1.KesehatanController,
            alat_controller_1.AlatController,
            usulan_controller_1.UsulanController,
            keranjang_controller_1.KeranjangController,
            peminjaman_controller_1.PeminjamanController,
            approval_controller_1.ApprovalController,
            serah_terima_controller_1.SerahTerimaController,
            penilaian_controller_1.PenilaianController,
            lampiran_controller_1.LampiranController,
            master_controller_1.MasterController,
            laporan_controller_1.LaporanController,
            notifikasi_controller_1.NotifikasiController,
            kuesioner_controller_1.KuesionerController,
            sertifikat_controller_1.SertifikatController,
            jadwal_controller_1.JadwalController,
        ],
        providers: [
            { provide: konfigurasi_1.KONFIGURASI, useFactory: () => (0, konfigurasi_1.bacaKonfigurasi)() },
            oracle_service_1.OracleService,
            pengguna_repository_1.PenggunaRepository,
            alat_repository_1.AlatRepository,
            usulan_repository_1.UsulanRepository,
            usulan_service_1.UsulanService,
            keranjang_repository_1.KeranjangRepository,
            peminjaman_repository_1.PeminjamanRepository,
            peminjaman_service_1.PeminjamanService,
            approval_repository_1.ApprovalRepository,
            approval_service_1.ApprovalService,
            serah_terima_repository_1.SerahTerimaRepository,
            serah_terima_service_1.SerahTerimaService,
            penilaian_repository_1.PenilaianRepository,
            lampiran_repository_1.LampiranRepository,
            lampiran_service_1.LampiranService,
            master_repository_1.MasterRepository,
            laporan_repository_1.LaporanRepository,
            notifikasi_repository_1.NotifikasiRepository,
            kuesioner_repository_1.KuesionerRepository,
            sertifikat_repository_1.SertifikatRepository,
            jadwal_repository_1.JadwalRepository,
            notifikasi_service_1.NotifikasiService,
            { provide: pengirim_1.PENGIRIM_NOTIFIKASI, useClass: pengirim_1.PengirimPencatat },
            auth_service_1.AuthService,
            {
                provide: identitas_1.PENYEDIA_IDENTITAS,
                inject: [konfigurasi_1.KONFIGURASI],
                useFactory: (konf) => konf.AUTH_LEWATI_DIREKTORI ? new identitas_1.PenyediaLewati() : new identitas_1.PenyediaDirektori(),
            },
            // Seluruh endpoint tertutup secara bawaan; yang publik ditandai @Publik().
            { provide: core_1.APP_GUARD, useClass: auth_guard_1.AuthGuard },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map