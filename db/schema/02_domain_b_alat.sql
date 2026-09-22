-- Domain B — Data alat (PRD 6.3), beserta tabel lampiran bersama (PRD 6.7)
-- Dijalankan sebagai IPTOOLS_NEW, setelah 01_domain_a_pengguna.sql.

SET SQLBLANKLINES ON
SET DEFINE OFF

--------------------------------------------------------------------------------
-- lampiran — satu tempat untuk seluruh berkas (PRD 6.7)
--------------------------------------------------------------------------------
-- Menggantikan enam pola berbeda di sistem lama: GAMBAR1..4, FOTO1..4,
-- FOTO_KENDARAAN1..3, DATA_KERUSAKAN_FOTO, MASTER_MANUALBOOK, dan tujuh kolom
-- DOKUMEN_* pada laporan kerusakan.
--
-- Batas panjang nama berkas di sistem lama menyakitkan: GAMBAR1..3 hanya 50
-- karakter dan DOKUMEN_BA hanya 20. Di sini tidak ada batas semu semacam itu.
CREATE TABLE lampiran (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entitas       VARCHAR2(40)  NOT NULL,   -- 'ALAT', 'KERUSAKAN', 'SERAH_TERIMA', ...
  entitas_id    NUMBER        NOT NULL,
  jenis         VARCHAR2(40)  NOT NULL,   -- 'GAMBAR', 'MANUAL', 'SERTIFIKAT', ...
  nama_berkas   VARCHAR2(500) NOT NULL,
  lokasi        VARCHAR2(1000),
  tipe_media    VARCHAR2(100),
  ukuran_bita   NUMBER,
  urutan        NUMBER DEFAULT 0 NOT NULL,
  -- Berkas yang tercatat tetapi fisiknya sudah tidak ada tetap dibawa dan
  -- ditandai, agar kehilangan terlihat, bukan tersembunyi (PRD 7.3).
  berkas_hilang NUMBER(1) DEFAULT 0 NOT NULL,
  diunggah_oleh NUMBER,
  dibuat_pada   TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  id_lama       VARCHAR2(60),
  CONSTRAINT lampiran_pengunggah_fk FOREIGN KEY (diunggah_oleh) REFERENCES pengguna (id),
  CONSTRAINT lampiran_hilang_ck CHECK (berkas_hilang IN (0,1)),
  CONSTRAINT lampiran_entitas_ck CHECK (entitas IN
    ('ALAT','ALAT_SERTIFIKAT','KERUSAKAN','SERAH_TERIMA','PEMINJAMAN','PEMINJAMAN_ALAT'))
);

CREATE INDEX lampiran_entitas_ix ON lampiran (entitas, entitas_id);

--------------------------------------------------------------------------------
-- alat
--------------------------------------------------------------------------------
CREATE TABLE alat (
  id                NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode_barcode      VARCHAR2(60),
  nama              VARCHAR2(500) NOT NULL,
  nama_panggilan    VARCHAR2(500),
  spesifikasi       VARCHAR2(3000),
  fungsi            VARCHAR2(1000),

  -- Dahulu teks bebas (JNS, KONDISI, LOKASI) yang mudah tidak seragam,
  -- sekarang menunjuk daftar pilihan terpusat.
  jenis_id          NUMBER,
  kondisi_id        NUMBER,
  lokasi_id         NUMBER,
  persen_kondisi    NUMBER,

  unit_id           NUMBER,
  bidang_id         NUMBER,

  kode_maximo       VARCHAR2(60),
  nomor_aset        VARCHAR2(60),
  tahun_perolehan   NUMBER,
  nilai_kontrak     NUMBER,
  masa_manfaat      NUMBER,
  -- Dipakai rumus efektivitas: pemakaian setahun dibanding estimasi ini
  -- (PRD 8.3.2.1).
  estimasi_pertahun NUMBER,
  estimasi_persurat NUMBER,

  status            VARCHAR2(20),
  status_perbaikan  VARCHAR2(20),

  dihapus_pada      TIMESTAMP WITH TIME ZONE,   -- menggantikan DAFTAR_TOOL_DELETED
  dibuat_oleh       NUMBER,
  dibuat_pada       TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  id_lama           NUMBER,

  CONSTRAINT alat_id_lama_uk UNIQUE (id_lama),
  CONSTRAINT alat_unit_fk    FOREIGN KEY (unit_id)    REFERENCES unit (id),
  CONSTRAINT alat_bidang_fk  FOREIGN KEY (bidang_id)  REFERENCES bidang (id),
  CONSTRAINT alat_jenis_fk   FOREIGN KEY (jenis_id)   REFERENCES referensi (id),
  CONSTRAINT alat_kondisi_fk FOREIGN KEY (kondisi_id) REFERENCES referensi (id),
  CONSTRAINT alat_lokasi_fk  FOREIGN KEY (lokasi_id)  REFERENCES referensi (id),
  CONSTRAINT alat_pembuat_fk FOREIGN KEY (dibuat_oleh) REFERENCES pengguna (id)
);

CREATE INDEX alat_unit_ix    ON alat (unit_id);
CREATE INDEX alat_bidang_ix  ON alat (bidang_id);
CREATE INDEX alat_barcode_ix ON alat (kode_barcode);
CREATE INDEX alat_hapus_ix   ON alat (dihapus_pada);

--------------------------------------------------------------------------------
-- alat_aksesoris
--------------------------------------------------------------------------------
CREATE TABLE alat_aksesoris (
  id             NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alat_id        NUMBER NOT NULL,
  nama           VARCHAR2(500) NOT NULL,
  jumlah         NUMBER,
  satuan         VARCHAR2(100),
  standar        NUMBER,
  standar_jalan  NUMBER,
  dibuat_pada    TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  id_lama        NUMBER,
  CONSTRAINT alat_aksesoris_uk UNIQUE (id_lama),
  CONSTRAINT alat_aksesoris_fk FOREIGN KEY (alat_id) REFERENCES alat (id)
);

CREATE INDEX alat_aksesoris_alat_ix ON alat_aksesoris (alat_id);

--------------------------------------------------------------------------------
-- alat_sertifikat — kalibrasi
--------------------------------------------------------------------------------
CREATE TABLE alat_sertifikat (
  id             NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alat_id        NUMBER NOT NULL,
  nomor          VARCHAR2(255),
  tanggal_kalibrasi DATE,
  -- Tanggal disarankan kalibrasi ulang, penanda sertifikat kedaluwarsa.
  tanggal_saran  DATE,
  hasil          VARCHAR2(255),
  pelaksana      VARCHAR2(255),
  dibuat_pada    TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  id_lama        NUMBER,
  CONSTRAINT alat_sertifikat_uk UNIQUE (id_lama),
  CONSTRAINT alat_sertifikat_fk FOREIGN KEY (alat_id) REFERENCES alat (id)
);

CREATE INDEX alat_sertifikat_alat_ix ON alat_sertifikat (alat_id);

--------------------------------------------------------------------------------
-- alat_usulan_perubahan
--------------------------------------------------------------------------------
-- DAFTAR_TOOL_TEMP_ACTION menyalin hampir seluruh kolom DAFTAR_TOOL hanya untuk
-- menampung usulan yang menunggu persetujuan. Akibatnya setiap kolom baru harus
-- ditambahkan di dua tempat, dan keduanya sudah tidak sinkron.
--
-- Di sini isi usulan disimpan sebagai dokumen JSON, sehingga menambah kolom
-- pada alat tidak lagi menuntut perubahan di tabel ini.
CREATE TABLE alat_usulan_perubahan (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alat_id       NUMBER,                    -- kosong bila usulan penambahan alat baru
  tindakan      VARCHAR2(20) NOT NULL,     -- TAMBAH / UBAH / HAPUS
  isi_usulan    CLOB,
  keterangan    VARCHAR2(2000),
  status        VARCHAR2(30) NOT NULL,
  diusulkan_oleh NUMBER,
  nama_pengusul_historis VARCHAR2(255),
  dibuat_pada   TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  id_lama       NUMBER,
  CONSTRAINT alat_usulan_uk        UNIQUE (id_lama),
  CONSTRAINT alat_usulan_alat_fk   FOREIGN KEY (alat_id) REFERENCES alat (id),
  CONSTRAINT alat_usulan_orang_fk  FOREIGN KEY (diusulkan_oleh) REFERENCES pengguna (id),
  CONSTRAINT alat_usulan_isi_ck    CHECK (isi_usulan IS JSON),
  CONSTRAINT alat_usulan_tindakan_ck CHECK (tindakan IN ('TAMBAH','UBAH','HAPUS'))
);

CREATE INDEX alat_usulan_status_ix ON alat_usulan_perubahan (status);

--------------------------------------------------------------------------------
-- alat_usulan_riwayat
--------------------------------------------------------------------------------
CREATE TABLE alat_usulan_riwayat (
  id           NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usulan_id    NUMBER,
  status       VARCHAR2(255),
  keterangan   VARCHAR2(2000),
  oleh         NUMBER,
  nama_historis VARCHAR2(255),
  dibuat_pada  TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  id_lama      NUMBER,
  CONSTRAINT alat_usulan_riwayat_uk UNIQUE (id_lama),
  CONSTRAINT alat_usulan_riwayat_fk FOREIGN KEY (usulan_id) REFERENCES alat_usulan_perubahan (id),
  CONSTRAINT alat_usulan_riwayat_orang_fk FOREIGN KEY (oleh) REFERENCES pengguna (id)
);

EXIT
