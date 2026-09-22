-- Domain A — Data pengguna (PRD 6.2)
-- Dijalankan sebagai IPTOOLS_NEW.
--   sqlplus -S -L IPTOOLS_NEW/<sandi>@localhost:1521/XEPDB1 @db/schema/01_domain_a_pengguna.sql
--
-- Ketentuan yang berlaku di seluruh berkas schema:
--   - kunci utama NUMBER GENERATED ALWAYS AS IDENTITY
--   - id_lama menyimpan kunci dari sistem lama, permanen (PRD 7.1 butir 3)
--   - waktu memakai TIMESTAMP WITH TIME ZONE
--   - tidak ada trigger, tidak ada stored procedure (PRD 8.3.3)

-- Baris kosong di tengah pernyataan tidak boleh dianggap akhir pernyataan,
-- dan '&' pada teks tidak boleh diperlakukan sebagai variabel substitusi.
SET SQLBLANKLINES ON
SET DEFINE OFF

--------------------------------------------------------------------------------
-- referensi — daftar pilihan terpusat (PRD 6.7)
--------------------------------------------------------------------------------
CREATE TABLE referensi (
  id          NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipe        VARCHAR2(40)  NOT NULL,
  kode        VARCHAR2(60)  NOT NULL,
  nama        VARCHAR2(255) NOT NULL,
  urutan      NUMBER        DEFAULT 0 NOT NULL,
  aktif       NUMBER(1)     DEFAULT 1 NOT NULL,
  -- Nilai yang muncul di data lama tetapi tidak ada di tabel daftar pilihannya.
  -- Dibuat saat migrasi supaya tidak ada data yang hilang, dan ditandai agar
  -- dapat ditinjau serta dirapikan admin (PRD 7.3).
  dari_migrasi NUMBER(1)    DEFAULT 0 NOT NULL,
  id_lama     VARCHAR2(60),
  dibuat_pada TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT referensi_uk    UNIQUE (tipe, kode),
  CONSTRAINT referensi_aktif_ck CHECK (aktif IN (0,1)),
  CONSTRAINT referensi_migrasi_ck CHECK (dari_migrasi IN (0,1)),
  CONSTRAINT referensi_tipe_ck CHECK (tipe IN (
    'JENIS_ALAT','KONDISI_ALAT','LOKASI_ALAT','TIPE_OH',
    'JENIS_ALUR','TINGKAT_KERUSAKAN','KATEGORI_PEMINJAMAN'))
);

--------------------------------------------------------------------------------
-- unit
--------------------------------------------------------------------------------
CREATE TABLE unit (
  id           NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nama         VARCHAR2(255) NOT NULL,
  kode_re      NUMBER,
  kode_maximo  VARCHAR2(255),
  deskripsi    VARCHAR2(255),
  nonaktif_pada TIMESTAMP WITH TIME ZONE,
  id_lama      NUMBER,          -- kosong untuk unit yang dibuat sistem baru
  CONSTRAINT unit_id_lama_uk UNIQUE (id_lama)
);

-- kode_re dipakai untuk memetakan pegawai ke unit: PAYROLL_ID (HR) = unit.kode_re
-- (PRD 8.3.2.3). Boleh kosong, karena tidak semua unit punya padanannya.
CREATE INDEX unit_kode_re_ix ON unit (kode_re);

--------------------------------------------------------------------------------
-- bidang
--------------------------------------------------------------------------------
CREATE TABLE bidang (
  id      NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nama    VARCHAR2(255) NOT NULL,
  -- Sama seperti referensi: 236 alat memakai nama bidang yang tidak pernah
  -- terdaftar di MASTER_BIDANG_TOOL. Nama itu didaftarkan saat migrasi dan
  -- ditandai agar dapat dirapikan admin (PRD 7.3).
  dari_migrasi NUMBER(1) DEFAULT 0 NOT NULL,
  id_lama NUMBER,
  CONSTRAINT bidang_id_lama_uk UNIQUE (id_lama),
  CONSTRAINT bidang_migrasi_ck CHECK (dari_migrasi IN (0,1))
);

--------------------------------------------------------------------------------
-- pengguna
--------------------------------------------------------------------------------
CREATE TABLE pengguna (
  id              NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nama            VARCHAR2(255) NOT NULL,
  email           VARCHAR2(255) NOT NULL,
  username        VARCHAR2(255),
  nipeg           VARCHAR2(60),

  -- Unit dan jabatan: di sistem lama keduanya hanya ada di HR (PRD 8.3.2.3).
  -- Selama akses HR belum tersedia, diisi berjenjang sesuai PRD 6.2.1 dan
  -- asalnya dicatat agar penyelarasan HR kelak dapat menimpa dengan benar.
  unit_id         NUMBER,
  jabatan         VARCHAR2(255),
  payroll_id      VARCHAR2(60),
  sumber_unit     VARCHAR2(20),
  sumber_jabatan  VARCHAR2(20),

  tanda_tangan    VARCHAR2(500),
  token_push      VARCHAR2(255),
  login_terakhir  TIMESTAMP WITH TIME ZONE,
  nonaktif_pada   TIMESTAMP WITH TIME ZONE,
  dibuat_pada     TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  id_lama         NUMBER,

  -- Data lama memuat 127 baris ganda: satu orang tercatat beberapa kali dengan
  -- email yang sama. Barisnya tetap dibawa (PRD 7.1 butir 1), tetapi satu
  -- ditetapkan sebagai baris utama dan sisanya menunjuk ke sana lewat kolom ini
  -- serta dinonaktifkan. Karena itu email TIDAK unik di tabel ini; yang unik
  -- adalah email di antara baris yang masih aktif (lihat indeks di bawah).
  duplikat_dari   NUMBER,

  CONSTRAINT pengguna_id_lama_uk UNIQUE (id_lama),
  CONSTRAINT pengguna_duplikat_fk FOREIGN KEY (duplikat_dari) REFERENCES pengguna (id),
  CONSTRAINT pengguna_unit_fk    FOREIGN KEY (unit_id) REFERENCES unit (id),
  CONSTRAINT pengguna_sumber_unit_ck CHECK (
    sumber_unit IN ('HR','AD','IMPOR','MIGRASI','ADMIN','SWADAYA')),
  CONSTRAINT pengguna_sumber_jab_ck CHECK (
    sumber_jabatan IN ('HR','AD','IMPOR','MIGRASI','ADMIN','SWADAYA'))
);

CREATE INDEX pengguna_unit_ix     ON pengguna (unit_id);
CREATE INDEX pengguna_username_ix ON pengguna (LOWER(username));
CREATE INDEX pengguna_duplikat_ix ON pengguna (duplikat_dari);

-- Satu email hanya boleh dimiliki satu baris aktif. Baris yang ditandai duplikat
-- (duplikat_dari terisi) dikecualikan, sehingga riwayat lama tetap tersimpan
-- tanpa membuat login menjadi ambigu.
CREATE UNIQUE INDEX pengguna_email_aktif_uk
  ON pengguna (CASE WHEN duplikat_dari IS NULL THEN LOWER(email) END);

--------------------------------------------------------------------------------
-- pengguna_peran
--------------------------------------------------------------------------------
-- Peran menentukan otorisasi dan tidak bergantung pada HR sama sekali —
-- inilah sebabnya ketiadaan akses HR tidak melumpuhkan approval (PRD 6.2.1).
CREATE TABLE pengguna_peran (
  id           NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pengguna_id  NUMBER       NOT NULL,
  peran        VARCHAR2(20) NOT NULL,
  unit_id      NUMBER,                     -- pembatas lingkup; kosong = seluruh unit
  dibuat_pada  TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  id_lama      NUMBER,
  CONSTRAINT pengguna_peran_fk     FOREIGN KEY (pengguna_id) REFERENCES pengguna (id),
  CONSTRAINT pengguna_peran_unit_fk FOREIGN KEY (unit_id)    REFERENCES unit (id),
  CONSTRAINT pengguna_peran_uk     UNIQUE (pengguna_id, peran, unit_id),
  CONSTRAINT pengguna_peran_ck     CHECK (peran IN (
    'PEMINJAM','PENGELOLA','MANAJER','GM','STAF','ADMIN_UNIT','ADMIN_SUPER'))
);

CREATE INDEX pengguna_peran_pengguna_ix ON pengguna_peran (pengguna_id);

--------------------------------------------------------------------------------
-- pengguna_bidang
--------------------------------------------------------------------------------
CREATE TABLE pengguna_bidang (
  id          NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pengguna_id NUMBER NOT NULL,
  bidang_id   NUMBER NOT NULL,
  dibuat_pada TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  id_lama     NUMBER,
  CONSTRAINT pengguna_bidang_fk    FOREIGN KEY (pengguna_id) REFERENCES pengguna (id),
  CONSTRAINT pengguna_bidang_b_fk  FOREIGN KEY (bidang_id)   REFERENCES bidang (id),
  CONSTRAINT pengguna_bidang_uk    UNIQUE (pengguna_id, bidang_id)
);

EXIT
