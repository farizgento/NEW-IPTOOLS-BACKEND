-- Domain E — Data utilitas pemakaian alat (PRD 6.6)
-- Dijalankan sebagai IPTOOLS_NEW, setelah 04_domain_d_serah_terima.sql.

SET SQLBLANKLINES ON
SET DEFINE OFF

--------------------------------------------------------------------------------
-- pemakaian_wo — work order Maximo yang menaungi pemakaian alat
--------------------------------------------------------------------------------
CREATE TABLE pemakaian_wo (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  peminjaman_id NUMBER NOT NULL,
  nomor_wo      VARCHAR2(255),
  siteid_maximo VARCHAR2(100),
  dibuat_oleh   NUMBER,
  nama_pembuat_historis VARCHAR2(255),
  dibuat_pada   TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  id_lama       NUMBER,
  CONSTRAINT pemakaian_wo_uk    UNIQUE (id_lama),
  CONSTRAINT pemakaian_wo_pm_fk FOREIGN KEY (peminjaman_id) REFERENCES peminjaman (id),
  CONSTRAINT pemakaian_wo_or_fk FOREIGN KEY (dibuat_oleh)   REFERENCES pengguna (id)
);

CREATE INDEX pemakaian_wo_pm_ix ON pemakaian_wo (peminjaman_id);

--------------------------------------------------------------------------------
-- pemakaian_wo_aktivitas
--------------------------------------------------------------------------------
-- 2.794 dari 3.183 aktivitas di data produksi tidak menunjuk work order sama
-- sekali — hanya menunjuk pengajuannya. Karena itu wo_id boleh kosong, dan
-- peminjaman_id disimpan agar aktivitas semacam itu tetap punya induk.
CREATE TABLE pemakaian_wo_aktivitas (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  wo_id         NUMBER,
  peminjaman_id NUMBER,
  kode_task     VARCHAR2(255),
  deskripsi     VARCHAR2(1000),
  estimasi_jam  VARCHAR2(20),
  dibuat_pada   TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  id_lama       NUMBER,
  CONSTRAINT pemakaian_akt_uk    UNIQUE (id_lama),
  CONSTRAINT pemakaian_akt_wo_fk FOREIGN KEY (wo_id)         REFERENCES pemakaian_wo (id),
  CONSTRAINT pemakaian_akt_pm_fk FOREIGN KEY (peminjaman_id) REFERENCES peminjaman (id),
  CONSTRAINT pemakaian_akt_induk_ck CHECK (wo_id IS NOT NULL OR peminjaman_id IS NOT NULL)
);

CREATE INDEX pemakaian_akt_wo_ix ON pemakaian_wo_aktivitas (wo_id);
CREATE INDEX pemakaian_akt_pm_ix ON pemakaian_wo_aktivitas (peminjaman_id);

--------------------------------------------------------------------------------
-- operator_alat
--------------------------------------------------------------------------------
CREATE TABLE operator_alat (
  id           NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alat_id      NUMBER NOT NULL,
  pengguna_id  NUMBER,
  email_historis VARCHAR2(500),
  kode_maximo  VARCHAR2(255),
  dibuat_pada  TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  id_lama      NUMBER,
  CONSTRAINT operator_alat_uk    UNIQUE (id_lama),
  CONSTRAINT operator_alat_al_fk FOREIGN KEY (alat_id)     REFERENCES alat (id),
  CONSTRAINT operator_alat_pg_fk FOREIGN KEY (pengguna_id) REFERENCES pengguna (id)
);

CREATE INDEX operator_alat_al_ix ON operator_alat (alat_id);

--------------------------------------------------------------------------------
-- kerusakan
--------------------------------------------------------------------------------
-- DATA_KERUSAKAN_TOOL punya 44 kolom untuk 32 baris data. Yang tidak dibawa:
--   - empat kelompok identitas berulang (MENGETAHUI1..3 + MANAJER_APPR,
--     masing-masing dengan nama, email, dan tanggal) menjadi baris di
--     kerusakan_persetujuan
--   - tujuh kolom DOKUMEN_* menjadi baris di lampiran. Salah satunya,
--     DOKUMEN_BA, hanya VARCHAR2(20) — terlalu pendek untuk nama berkas wajar
CREATE TABLE kerusakan (
  id                 NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alat_id            NUMBER,
  peminjaman_id      NUMBER,
  peminjaman_alat_id NUMBER,

  pelapor_id         NUMBER,
  nama_pelapor_historis VARCHAR2(255),
  tanggal_lapor      TIMESTAMP WITH TIME ZONE,

  lokasi             VARCHAR2(255),
  pekerjaan          VARCHAR2(500),
  detail             VARCHAR2(1000),
  investigasi_awal   VARCHAR2(1000),
  tingkat            VARCHAR2(100),
  tipe_perbaikan     VARCHAR2(100),
  waktu_penyelesaian DATE,
  jumlah_uji         NUMBER,
  keterangan_approval VARCHAR2(500),
  tanggal_penghapusan TIMESTAMP WITH TIME ZONE,

  pic_id             NUMBER,
  nama_pic_historis  VARCHAR2(500),

  status             VARCHAR2(100) NOT NULL,
  dibuat_pada        TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  id_lama            NUMBER,

  CONSTRAINT kerusakan_uk    UNIQUE (id_lama),
  CONSTRAINT kerusakan_al_fk FOREIGN KEY (alat_id)            REFERENCES alat (id),
  CONSTRAINT kerusakan_pm_fk FOREIGN KEY (peminjaman_id)      REFERENCES peminjaman (id),
  CONSTRAINT kerusakan_pa_fk FOREIGN KEY (peminjaman_alat_id) REFERENCES peminjaman_alat (id),
  CONSTRAINT kerusakan_pl_fk FOREIGN KEY (pelapor_id)         REFERENCES pengguna (id),
  CONSTRAINT kerusakan_pc_fk FOREIGN KEY (pic_id)             REFERENCES pengguna (id)
);

CREATE INDEX kerusakan_al_ix ON kerusakan (alat_id);
CREATE INDEX kerusakan_pm_ix ON kerusakan (peminjaman_id);

--------------------------------------------------------------------------------
-- kerusakan_persetujuan
--------------------------------------------------------------------------------
-- Menggantikan empat kelompok kolom berulang. Bila kelak diperlukan pihak
-- keempat yang mengetahui, tidak perlu mengubah tabel.
CREATE TABLE kerusakan_persetujuan (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kerusakan_id  NUMBER NOT NULL,
  urutan        NUMBER NOT NULL,
  peran         VARCHAR2(20) NOT NULL,
  pengguna_id   NUMBER,
  nama_historis VARCHAR2(255),
  email_historis VARCHAR2(255),
  jabatan_historis VARCHAR2(255),
  disetujui_pada TIMESTAMP WITH TIME ZONE,
  dibuat_pada   TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT kerusakan_pst_uk    UNIQUE (kerusakan_id, urutan),
  CONSTRAINT kerusakan_pst_kr_fk FOREIGN KEY (kerusakan_id) REFERENCES kerusakan (id),
  CONSTRAINT kerusakan_pst_pg_fk FOREIGN KEY (pengguna_id)  REFERENCES pengguna (id),
  CONSTRAINT kerusakan_pst_pr_ck CHECK (peran IN ('MENGETAHUI','MANAJER'))
);

CREATE INDEX kerusakan_pst_kr_ix ON kerusakan_persetujuan (kerusakan_id);

--------------------------------------------------------------------------------
-- kerusakan_mitra
--------------------------------------------------------------------------------
CREATE TABLE kerusakan_mitra (
  id           NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kerusakan_id NUMBER NOT NULL,
  nama_vendor  VARCHAR2(255),
  alamat       VARCHAR2(500),
  npwp         VARCHAR2(100),
  pic          VARCHAR2(255),
  email        VARCHAR2(255),
  tipe_po      VARCHAR2(20),
  nomor_po     VARCHAR2(100),
  garansi      VARCHAR2(255),
  status       VARCHAR2(100),
  dibuat_pada  TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  id_lama      NUMBER,
  CONSTRAINT kerusakan_mitra_uk    UNIQUE (id_lama),
  CONSTRAINT kerusakan_mitra_kr_fk FOREIGN KEY (kerusakan_id) REFERENCES kerusakan (id)
);

CREATE INDEX kerusakan_mitra_kr_ix ON kerusakan_mitra (kerusakan_id);

--------------------------------------------------------------------------------
-- Penilaian kondisi bertahap KERUSAKAN menunjuk laporan, bukan baris alat
--------------------------------------------------------------------------------
-- 105 baris penilaian bertahap KERUSAKAN tidak dapat dipindahkan pada Domain D
-- karena kaitannya lewat ID_KERUSAKAN, bukan ID_CART_DETAIL. Kolom ini yang
-- menampungnya, dan peminjaman_alat_id dibuat boleh kosong untuk baris itu.
ALTER TABLE penilaian_kondisi ADD kerusakan_ref NUMBER;
ALTER TABLE penilaian_kondisi MODIFY peminjaman_alat_id NULL;
ALTER TABLE penilaian_kondisi ADD CONSTRAINT penilaian_kr_fk
  FOREIGN KEY (kerusakan_ref) REFERENCES kerusakan (id);
ALTER TABLE penilaian_kondisi ADD CONSTRAINT penilaian_induk_ck
  CHECK (peminjaman_alat_id IS NOT NULL OR kerusakan_ref IS NOT NULL);

EXIT
