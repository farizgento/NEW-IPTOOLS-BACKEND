-- Domain C — Data peminjaman alat (PRD 6.4)
-- Dijalankan sebagai IPTOOLS_NEW, setelah 02_domain_b_alat.sql.

SET SQLBLANKLINES ON
SET DEFINE OFF

--------------------------------------------------------------------------------
-- keranjang — alat yang dipilih sebelum diajukan
--------------------------------------------------------------------------------
CREATE TABLE keranjang (
  id          NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pengguna_id NUMBER NOT NULL,
  alat_id     NUMBER NOT NULL,
  dibuat_pada TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  id_lama     NUMBER,
  CONSTRAINT keranjang_uk        UNIQUE (pengguna_id, alat_id),
  CONSTRAINT keranjang_id_lama_uk UNIQUE (id_lama),
  CONSTRAINT keranjang_pengguna_fk FOREIGN KEY (pengguna_id) REFERENCES pengguna (id),
  CONSTRAINT keranjang_alat_fk     FOREIGN KEY (alat_id)     REFERENCES alat (id)
);

--------------------------------------------------------------------------------
-- peminjaman
--------------------------------------------------------------------------------
-- Menggantikan DATA_CART_HEADER. Yang hilang dari sana, dan tidak digantikan
-- kolom apa pun:
--   - delapan kolom identitas dan tanggal approval, kini menjadi baris di
--     peminjaman_approval sehingga muat berapa pun tingkat approval
--   - STATUS_PERPANJANGAN, kini menjadi peristiwa di peminjaman_riwayat
--     (hanya 6 dari 2.465 pengajuan pernah memakainya)
--   - sembilan kolom tanggal peristiwa, kini dibaca dari riwayat
CREATE TABLE peminjaman (
  id              NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pekerjaan       VARCHAR2(1000),
  unit_id         NUMBER,
  tanggal_mulai   DATE,
  tanggal_selesai DATE,
  nomor_wo        VARCHAR2(255),
  tujuan          VARCHAR2(1000),
  kontak          VARCHAR2(500),

  jenis_alur_id   NUMBER,
  tipe_oh_id      NUMBER,

  -- Satu kolom status. Nilainya tetap sama persis seperti sistem lama
  -- (PRD 8.2), sehingga perbandingan perilaku tetap mungkin dilakukan.
  status          VARCHAR2(50) NOT NULL,

  peminjam_id     NUMBER,
  nama_peminjam_historis VARCHAR2(255),
  pengelola_historis     VARCHAR2(255),

  -- Instansi peminjam pada alur eksternal (PRD F3). Di sistem lama tidak ada
  -- tempatnya sama sekali, sehingga alur itu tidak pernah bisa dijalankan.
  instansi_eksternal      VARCHAR2(500),
  kontak_eksternal        VARCHAR2(500),
  nomor_surat_permohonan  VARCHAR2(255),

  dibuat_pada     TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  diubah_pada     TIMESTAMP WITH TIME ZONE,
  id_lama         NUMBER,

  CONSTRAINT peminjaman_id_lama_uk UNIQUE (id_lama),
  CONSTRAINT peminjaman_unit_fk    FOREIGN KEY (unit_id)       REFERENCES unit (id),
  CONSTRAINT peminjaman_alur_fk    FOREIGN KEY (jenis_alur_id) REFERENCES referensi (id),
  CONSTRAINT peminjaman_oh_fk      FOREIGN KEY (tipe_oh_id)    REFERENCES referensi (id),
  CONSTRAINT peminjaman_peminjam_fk FOREIGN KEY (peminjam_id)  REFERENCES pengguna (id)
);

CREATE INDEX peminjaman_status_ix   ON peminjaman (status);
CREATE INDEX peminjaman_unit_ix     ON peminjaman (unit_id);
CREATE INDEX peminjaman_peminjam_ix ON peminjaman (peminjam_id);
CREATE INDEX peminjaman_dibuat_ix   ON peminjaman (dibuat_pada);

--------------------------------------------------------------------------------
-- peminjaman_alat
--------------------------------------------------------------------------------
-- Status per alat memakai nilai bernama, menggantikan sepuluh kode angka yang
-- maknanya hanya ada di komentar procedure (PRD 6.4.1).
--
-- Kode angka aslinya tetap disimpan pada kode_status_lama supaya baris lama
-- dapat ditelusuri, dan supaya keputusan pemetaan dapat diperiksa ulang.
CREATE TABLE peminjaman_alat (
  id               NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  peminjaman_id    NUMBER NOT NULL,
  alat_id          NUMBER,
  status           VARCHAR2(30) NOT NULL,
  kode_status_lama NUMBER,
  jumlah_uji       NUMBER,
  keterangan_uji   VARCHAR2(500),
  tanggal_kirim    TIMESTAMP WITH TIME ZONE,
  tanggal_terima   TIMESTAMP WITH TIME ZONE,
  tanggal_kembali  TIMESTAMP WITH TIME ZONE,
  tanggal_selesai  TIMESTAMP WITH TIME ZONE,
  pengelola_historis VARCHAR2(255),
  dibuat_pada      TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  id_lama          NUMBER,
  CONSTRAINT peminjaman_alat_uk    UNIQUE (id_lama),
  CONSTRAINT peminjaman_alat_hd_fk FOREIGN KEY (peminjaman_id) REFERENCES peminjaman (id),
  CONSTRAINT peminjaman_alat_al_fk FOREIGN KEY (alat_id)       REFERENCES alat (id),
  CONSTRAINT peminjaman_alat_st_ck CHECK (status IN (
    'DIAJUKAN','MASUK_SERAH_TERIMA','DIKIRIM','DITERIMA','DIKEMBALIKAN','SELESAI'))
);

CREATE INDEX peminjaman_alat_hd_ix ON peminjaman_alat (peminjaman_id);
CREATE INDEX peminjaman_alat_al_ix ON peminjaman_alat (alat_id);

--------------------------------------------------------------------------------
-- peminjaman_alat_aksesoris
--------------------------------------------------------------------------------
CREATE TABLE peminjaman_alat_aksesoris (
  id                NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  peminjaman_alat_id NUMBER NOT NULL,
  alat_aksesoris_id  NUMBER,
  ikut_dikirim       NUMBER(1) DEFAULT 0 NOT NULL,
  dibuat_pada        TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  id_lama            NUMBER,
  CONSTRAINT pma_uk    UNIQUE (id_lama),
  CONSTRAINT pma_pa_fk FOREIGN KEY (peminjaman_alat_id) REFERENCES peminjaman_alat (id),
  CONSTRAINT pma_ak_fk FOREIGN KEY (alat_aksesoris_id)  REFERENCES alat_aksesoris (id),
  CONSTRAINT pma_kirim_ck CHECK (ikut_dikirim IN (0,1))
);

CREATE INDEX pma_pa_ix ON peminjaman_alat_aksesoris (peminjaman_alat_id);

--------------------------------------------------------------------------------
-- peminjaman_approval
--------------------------------------------------------------------------------
-- Inti penyederhanaan Domain C. Delapan kolom di header hanya sanggup menampung
-- dua tingkat approval; menambah tahap GM berarti menambah empat kolom lagi.
--
-- Dalam bentuk baris, panjang rantai ditentukan varian alur (PRD 9.1):
-- satu baris untuk dalam unit, dua untuk antar unit, tiga untuk eksternal.
CREATE TABLE peminjaman_approval (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  peminjaman_id NUMBER NOT NULL,
  urutan        NUMBER NOT NULL,
  tahap         VARCHAR2(20) NOT NULL,
  keputusan     VARCHAR2(20) NOT NULL,
  alasan        VARCHAR2(2000),
  penyetuju_id  NUMBER,
  nama_penyetuju_historis VARCHAR2(255),
  diputuskan_pada TIMESTAMP WITH TIME ZONE,
  -- Sistem lama hanya menyimpan approval terakhir per tingkat; baris yang
  -- disusun kembali dari riwayat ditandai di sini (PRD 7.3).
  disusun_ulang NUMBER(1) DEFAULT 0 NOT NULL,
  dibuat_pada   TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT peminjaman_approval_uk    UNIQUE (peminjaman_id, urutan),
  CONSTRAINT peminjaman_approval_hd_fk FOREIGN KEY (peminjaman_id) REFERENCES peminjaman (id),
  CONSTRAINT peminjaman_approval_or_fk FOREIGN KEY (penyetuju_id)  REFERENCES pengguna (id),
  CONSTRAINT peminjaman_approval_th_ck CHECK (tahap IN ('PENGELOLA','MANAJER','GM')),
  CONSTRAINT peminjaman_approval_kp_ck CHECK (keputusan IN ('MENUNGGU','SETUJU','TOLAK')),
  CONSTRAINT peminjaman_approval_su_ck CHECK (disusun_ulang IN (0,1))
);

CREATE INDEX peminjaman_approval_hd_ix ON peminjaman_approval (peminjaman_id);
-- Inbox "Tugas Saya" (F4) membaca lewat indeks ini.
CREATE INDEX peminjaman_approval_antre_ix ON peminjaman_approval (keputusan, tahap);

--------------------------------------------------------------------------------
-- peminjaman_riwayat
--------------------------------------------------------------------------------
-- LOG_STATUS_PEMINJAMAN hanya mencatat status baru. Di sini status lama ikut
-- disimpan, sehingga garis waktu (F10) tidak perlu menebak urutan.
CREATE TABLE peminjaman_riwayat (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  peminjaman_id NUMBER NOT NULL,
  status_lama   VARCHAR2(50),
  status_baru   VARCHAR2(50) NOT NULL,
  keterangan    VARCHAR2(2000),
  oleh          NUMBER,
  nama_historis VARCHAR2(255),
  dibuat_pada   TIMESTAMP WITH TIME ZONE NOT NULL,
  id_lama       NUMBER,
  CONSTRAINT peminjaman_riwayat_uk    UNIQUE (id_lama),
  CONSTRAINT peminjaman_riwayat_hd_fk FOREIGN KEY (peminjaman_id) REFERENCES peminjaman (id),
  CONSTRAINT peminjaman_riwayat_or_fk FOREIGN KEY (oleh)          REFERENCES pengguna (id)
);

CREATE INDEX peminjaman_riwayat_hd_ix ON peminjaman_riwayat (peminjaman_id, dibuat_pada);

EXIT
