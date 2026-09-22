-- Domain F — Pendukung (PRD 6.7), sisa yang belum dibuat
-- `referensi` dan `lampiran` sudah dibuat di berkas 01 dan 02.
-- Dijalankan sebagai IPTOOLS_NEW, setelah 05_domain_e_pemakaian.sql.

SET SQLBLANKLINES ON
SET DEFINE OFF

--------------------------------------------------------------------------------
-- proyek
--------------------------------------------------------------------------------
-- MASTER_DATA_PROJECT memakai NAMA_PEKERJAAN sebagai kunci utama — teks bebas
-- sepanjang 500 karakter. Di sini kuncinya angka, dan namanya menjadi kolom
-- biasa yang boleh berubah tanpa memutus rujukan.
CREATE TABLE proyek (
  id              NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nama_pekerjaan  VARCHAR2(500) NOT NULL,
  tanggal_mulai   DATE,
  tanggal_selesai DATE,
  siteco          VARCHAR2(255),
  tipe_oh_id      NUMBER,
  dibuat_pada     TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  id_lama         VARCHAR2(500),
  CONSTRAINT proyek_uk    UNIQUE (id_lama),
  CONSTRAINT proyek_oh_fk FOREIGN KEY (tipe_oh_id) REFERENCES referensi (id)
);

CREATE INDEX proyek_nama_ix ON proyek (UPPER(nama_pekerjaan));

--------------------------------------------------------------------------------
-- pertanyaan_kuesioner
--------------------------------------------------------------------------------
CREATE TABLE pertanyaan_kuesioner (
  id          NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kategori    VARCHAR2(100),
  pertanyaan  VARCHAR2(500) NOT NULL,
  urutan      NUMBER DEFAULT 0 NOT NULL,
  aktif       NUMBER(1) DEFAULT 1 NOT NULL,
  dibuat_pada TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  id_lama     NUMBER,
  CONSTRAINT pertanyaan_uk       UNIQUE (id_lama),
  CONSTRAINT pertanyaan_aktif_ck CHECK (aktif IN (0,1))
);

--------------------------------------------------------------------------------
-- kuesioner
--------------------------------------------------------------------------------
CREATE TABLE kuesioner (
  id               NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  peminjaman_id    NUMBER,
  tanggal          TIMESTAMP WITH TIME ZONE,
  nama_perusahaan  VARCHAR2(500),
  nama_unit        VARCHAR2(500),
  jenjang_jabatan  VARCHAR2(500),
  bidang_pekerjaan VARCHAR2(500),
  unit_oh          VARCHAR2(255),
  jenis_inspeksi   VARCHAR2(255),
  status           VARCHAR2(100),
  pengisi_id       NUMBER,
  nama_pengisi_historis VARCHAR2(300),
  dibuat_pada      TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  id_lama          NUMBER,
  CONSTRAINT kuesioner_uk    UNIQUE (id_lama),
  CONSTRAINT kuesioner_pm_fk FOREIGN KEY (peminjaman_id) REFERENCES peminjaman (id),
  CONSTRAINT kuesioner_pg_fk FOREIGN KEY (pengisi_id)    REFERENCES pengguna (id)
);

CREATE INDEX kuesioner_pm_ix ON kuesioner (peminjaman_id);

--------------------------------------------------------------------------------
-- kuesioner_jawaban
--------------------------------------------------------------------------------
CREATE TABLE kuesioner_jawaban (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kuesioner_id  NUMBER NOT NULL,
  pertanyaan_id NUMBER,
  kepentingan   VARCHAR2(2000),
  kinerja       VARCHAR2(2000),
  penjawab_id   NUMBER,
  email_historis VARCHAR2(300),
  dibuat_pada   TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  id_lama       NUMBER,
  CONSTRAINT kuesioner_jwb_uk    UNIQUE (id_lama),
  -- Satu jawaban per pertanyaan per sesi. Procedure lama selalu menambah baris,
  -- sehingga menjawab ulang menggandakan jawaban dan merusak hitungan lengkap
  -- (docs/aturan-bisnis/kuesioner.md 4.1).
  CONSTRAINT kuesioner_jwb_satu_uk UNIQUE (kuesioner_id, pertanyaan_id),
  CONSTRAINT kuesioner_jwb_ks_fk FOREIGN KEY (kuesioner_id)  REFERENCES kuesioner (id),
  CONSTRAINT kuesioner_jwb_pt_fk FOREIGN KEY (pertanyaan_id) REFERENCES pertanyaan_kuesioner (id),
  CONSTRAINT kuesioner_jwb_pg_fk FOREIGN KEY (penjawab_id)   REFERENCES pengguna (id)
);

CREATE INDEX kuesioner_jwb_ks_ix ON kuesioner_jawaban (kuesioner_id);

--------------------------------------------------------------------------------
-- pesan
--------------------------------------------------------------------------------
-- 45 pesan sejak sistem berjalan. Dibawa apa adanya sambil menunggu keputusan
-- apakah fitur ini dipertahankan atau digantikan komentar pada pengajuan
-- (PRD 12.5).
CREATE TABLE pesan (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dari_id       NUMBER,
  dari_email    VARCHAR2(500),
  ke_id         NUMBER,
  ke_email      VARCHAR2(500),
  isi           VARCHAR2(500),
  sudah_dibaca  NUMBER(1) DEFAULT 0 NOT NULL,
  alat_id       NUMBER,
  peminjaman_id NUMBER,
  dibuat_pada   TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  id_lama       NUMBER,
  CONSTRAINT pesan_uk       UNIQUE (id_lama),
  CONSTRAINT pesan_dari_fk  FOREIGN KEY (dari_id)       REFERENCES pengguna (id),
  CONSTRAINT pesan_ke_fk    FOREIGN KEY (ke_id)         REFERENCES pengguna (id),
  CONSTRAINT pesan_alat_fk  FOREIGN KEY (alat_id)       REFERENCES alat (id),
  CONSTRAINT pesan_pm_fk    FOREIGN KEY (peminjaman_id) REFERENCES peminjaman (id),
  CONSTRAINT pesan_baca_ck  CHECK (sudah_dibaca IN (0,1))
);

--------------------------------------------------------------------------------
-- notifikasi
--------------------------------------------------------------------------------
-- Tabel baru: sistem lama mengirim notifikasi tanpa mencatat apa pun, sehingga
-- tidak ada cara mengetahui apakah sebuah pengingat pernah sampai (PRD 6.7).
CREATE TABLE notifikasi (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  penerima_id   NUMBER,
  penerima_email VARCHAR2(500),
  kanal         VARCHAR2(20) NOT NULL,
  perihal       VARCHAR2(255),
  isi           VARCHAR2(4000),
  tautan        VARCHAR2(1000),
  entitas       VARCHAR2(40),
  entitas_id    NUMBER,
  jadwal_kirim  TIMESTAMP WITH TIME ZONE,
  terkirim_pada TIMESTAMP WITH TIME ZONE,
  status        VARCHAR2(20) DEFAULT 'MENUNGGU' NOT NULL,
  percobaan     NUMBER DEFAULT 0 NOT NULL,
  galat_terakhir VARCHAR2(1000),
  dibuat_pada   TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT notifikasi_pg_fk FOREIGN KEY (penerima_id) REFERENCES pengguna (id),
  CONSTRAINT notifikasi_kn_ck CHECK (kanal  IN ('SUREL','PUSH','WHATSAPP')),
  CONSTRAINT notifikasi_st_ck CHECK (status IN ('MENUNGGU','TERKIRIM','GAGAL','BATAL'))
);

CREATE INDEX notifikasi_jadwal_ix ON notifikasi (status, jadwal_kirim);

EXIT
