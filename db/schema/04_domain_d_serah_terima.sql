-- Domain D — Data utilitas peminjaman alat (PRD 6.5)
-- Dijalankan sebagai IPTOOLS_NEW, setelah 03_domain_c_peminjaman.sql.

SET SQLBLANKLINES ON
SET DEFINE OFF

--------------------------------------------------------------------------------
-- serah_terima
--------------------------------------------------------------------------------
-- Menggantikan DATA_CART_SURAT_JALAN. Dipakai untuk kedua arah: pengiriman ke
-- peminjam dan pengembalian ke pengelola.
--
-- Dua kolom yang tidak ada di sistem lama:
--   - bentuk    : PENUH atau RINGKAS. Varian "ambil di gudang" memakai serah
--                 terima ringkas — tanpa kendaraan dan pengemudi, konfirmasi
--                 di tempat (PRD 9.2.1)
--   - kode_konfirmasi : enam digit tercetak di dokumen, dipakai peminjam yang
--                 tidak menerima notifikasi (PRD F8 jalur 2)
CREATE TABLE serah_terima (
  id              NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  peminjaman_id   NUMBER NOT NULL,
  arah            VARCHAR2(10) NOT NULL,
  bentuk          VARCHAR2(10) DEFAULT 'PENUH' NOT NULL,
  surat_ke        NUMBER DEFAULT 0 NOT NULL,
  status          VARCHAR2(30) NOT NULL,

  nomor_kendaraan VARCHAR2(255),
  jenis_kendaraan VARCHAR2(255),
  pengemudi       VARCHAR2(255),

  kode_konfirmasi VARCHAR2(10),
  kode_kedaluwarsa TIMESTAMP WITH TIME ZONE,
  percobaan_kode  NUMBER DEFAULT 0 NOT NULL,

  dibuat_oleh     NUMBER,
  nama_pembuat_historis VARCHAR2(255),
  dibuat_pada     TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  diserahkan_pada TIMESTAMP WITH TIME ZONE,
  id_lama         NUMBER,

  CONSTRAINT serah_terima_uk     UNIQUE (id_lama),
  CONSTRAINT serah_terima_pm_fk  FOREIGN KEY (peminjaman_id) REFERENCES peminjaman (id),
  CONSTRAINT serah_terima_or_fk  FOREIGN KEY (dibuat_oleh)   REFERENCES pengguna (id),
  CONSTRAINT serah_terima_ar_ck  CHECK (arah   IN ('KIRIM','KEMBALI')),
  CONSTRAINT serah_terima_bt_ck  CHECK (bentuk IN ('PENUH','RINGKAS')),
  CONSTRAINT serah_terima_st_ck  CHECK (status IN ('DRAFT','SENT','RETURN','SELESAI'))
);

CREATE INDEX serah_terima_pm_ix ON serah_terima (peminjaman_id);

--------------------------------------------------------------------------------
-- serah_terima_alat
--------------------------------------------------------------------------------
-- DATA_CART_SURAT_JALAN_TOOL tidak menyimpan alat maupun kode barcodenya —
-- keduanya hanya dapat dicapai lewat dua JOIN. Akibatnya layar penerimaan tidak
-- bisa menampilkan kode barcode untuk dicocokkan peminjam (PRD 6.0 nomor 7).
--
-- Di sini alat dirujuk langsung, dan cara konfirmasinya dicatat.
CREATE TABLE serah_terima_alat (
  id                NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  serah_terima_id   NUMBER NOT NULL,
  peminjaman_alat_id NUMBER NOT NULL,
  alat_id           NUMBER,
  status            VARCHAR2(30) NOT NULL,

  -- Bagaimana penerimaan alat ini dikonfirmasi (PRD F8). Dicatat agar dapat
  -- diaudit: berapa yang dikonfirmasi peminjam sendiri, berapa yang diwakilkan.
  metode_konfirmasi VARCHAR2(20),
  alasan_konfirmasi VARCHAR2(1000),
  dikonfirmasi_oleh NUMBER,
  dikonfirmasi_pada TIMESTAMP WITH TIME ZONE,

  dibuat_pada       TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  id_lama           NUMBER,

  CONSTRAINT sta_uk    UNIQUE (id_lama),
  CONSTRAINT sta_st_fk FOREIGN KEY (serah_terima_id)    REFERENCES serah_terima (id),
  CONSTRAINT sta_pa_fk FOREIGN KEY (peminjaman_alat_id) REFERENCES peminjaman_alat (id),
  CONSTRAINT sta_al_fk FOREIGN KEY (alat_id)            REFERENCES alat (id),
  CONSTRAINT sta_or_fk FOREIGN KEY (dikonfirmasi_oleh)  REFERENCES pengguna (id),
  CONSTRAINT sta_mk_ck CHECK (metode_konfirmasi IN
    ('TAUTAN','KODE','TANDA_TANGAN','PETUGAS','PINDAI','MIGRASI'))
);

CREATE INDEX sta_st_ix ON serah_terima_alat (serah_terima_id);
CREATE INDEX sta_pa_ix ON serah_terima_alat (peminjaman_alat_id);

--------------------------------------------------------------------------------
-- kategori_kondisi
--------------------------------------------------------------------------------
-- 18 pilihan dalam 5 grup, bobot berjumlah 100. Pilihan bernilai 100 pada tiap
-- grup adalah yang dipakai jalur "semua alat kondisi baik" (PRD F6).
CREATE TABLE kategori_kondisi (
  id           NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  grup         NUMBER NOT NULL,
  keterangan   VARCHAR2(400) NOT NULL,
  bobot        NUMBER NOT NULL,
  nilai        NUMBER NOT NULL,
  id_lama      NUMBER,
  CONSTRAINT kategori_kondisi_uk UNIQUE (id_lama)
);

CREATE INDEX kategori_kondisi_grup_ix ON kategori_kondisi (grup);

--------------------------------------------------------------------------------
-- penilaian_kondisi
--------------------------------------------------------------------------------
-- Tabel terbesar: 83.220 baris, 56% dari seluruh isi basis data.
--
-- Bentuknya sudah benar di sistem lama (satu baris per alat per tahap per
-- kategori). Yang diperbaiki hanya namanya — di produksi tabelnya bernama
-- DATA_CART_DETAIL_RELIABIITY, salah ketik — dan enam kolom ringkasan di
-- DATA_CART_DETAIL yang menduplikasi isinya tidak ikut dibawa (PRD 6.4).
CREATE TABLE penilaian_kondisi (
  id                 NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  peminjaman_alat_id NUMBER NOT NULL,
  kategori_id        NUMBER,
  tahap              VARCHAR2(20) NOT NULL,
  keterangan         VARCHAR2(500),
  kerusakan_id       NUMBER,
  dinilai_oleh       NUMBER,
  nama_penilai_historis VARCHAR2(255),
  dibuat_pada        TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  id_lama            NUMBER,
  CONSTRAINT penilaian_uk    UNIQUE (id_lama),
  CONSTRAINT penilaian_pa_fk FOREIGN KEY (peminjaman_alat_id) REFERENCES peminjaman_alat (id),
  CONSTRAINT penilaian_kt_fk FOREIGN KEY (kategori_id)        REFERENCES kategori_kondisi (id),
  CONSTRAINT penilaian_or_fk FOREIGN KEY (dinilai_oleh)       REFERENCES pengguna (id),
  -- Lima tahap yang benar-benar dipakai di data produksi (PRD 6.0 nomor 6).
  CONSTRAINT penilaian_th_ck CHECK (tahap IN
    ('BOOKED','SENT','RETURN','FINISH','KERUSAKAN'))
);

CREATE INDEX penilaian_pa_ix    ON penilaian_kondisi (peminjaman_alat_id, tahap);
CREATE INDEX penilaian_tahap_ix ON penilaian_kondisi (tahap);

EXIT
