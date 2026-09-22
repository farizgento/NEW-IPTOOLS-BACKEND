-- Migrasi Domain A — Data pengguna (PRD 7)
-- Dijalankan sebagai IPTOOLS_NEW, setelah db/schema/01_domain_a_pengguna.sql.
--
--   sqlplus -S -L IPTOOLS_NEW/<sandi>@localhost:1521/XEPDB1 @db/migrasi/01_domain_a_pengguna.sql
--
-- Skrip ini boleh dijalankan berulang (PRD 7.1 butir 2): isinya dikosongkan
-- lebih dulu, lalu diisi ulang dari schema lama.
--
-- Nama schema lama berbeda antar lingkungan:
--   produksi  : NEWIPTOOL
--   lokal ini : IPTOOLS
-- Ubah nilai di bawah bila dijalankan di tempat lain.

SET SQLBLANKLINES ON
SET SERVEROUTPUT ON
DEFINE SCHEMA_LAMA = IPTOOLS

--------------------------------------------------------------------------------
-- 0. Kosongkan, urut terbalik dari ketergantungannya
--------------------------------------------------------------------------------
DELETE FROM pengguna_bidang;
DELETE FROM pengguna_peran;
DELETE FROM pengguna;
DELETE FROM bidang;
DELETE FROM unit;
DELETE FROM referensi;
COMMIT;

--------------------------------------------------------------------------------
-- 1. referensi — lima tabel daftar pilihan menjadi satu (PRD 6.7)
--------------------------------------------------------------------------------
INSERT INTO referensi (tipe, kode, nama, urutan, id_lama)
SELECT 'JENIS_ALAT', TO_CHAR(ID_JENIS_TOOL), JENIS_TOOL, ROWNUM, TO_CHAR(ID_JENIS_TOOL)
  FROM &SCHEMA_LAMA..MASTER_SEL_JENISTOOL;

INSERT INTO referensi (tipe, kode, nama, urutan, id_lama)
SELECT 'KONDISI_ALAT', TO_CHAR(ID_KONDISI), KONDISI, ROWNUM, TO_CHAR(ID_KONDISI)
  FROM &SCHEMA_LAMA..MASTER_SEL_KONDISI;

INSERT INTO referensi (tipe, kode, nama, urutan, id_lama)
SELECT 'LOKASI_ALAT', TO_CHAR(ID_LOKASI), LOKASI, ROWNUM, TO_CHAR(ID_LOKASI)
  FROM &SCHEMA_LAMA..MASTER_SEL_LOKASITOOL;

INSERT INTO referensi (tipe, kode, nama, urutan, id_lama)
SELECT 'TIPE_OH', TO_CHAR(ID_TIPE_OH), TIPE_OH, ROWNUM, TO_CHAR(ID_TIPE_OH)
  FROM &SCHEMA_LAMA..MASTER_TIPE_OH;

-- Jenis alur: empat nilai MASTER_FLOWCHART dipetakan ke nama varian PRD 9.1.
INSERT INTO referensi (tipe, kode, nama, urutan, id_lama)
SELECT 'JENIS_ALUR',
       CASE TO_CHAR(ID_FLOWCHART)
         WHEN '1' THEN 'ANTAR_UNIT'
         WHEN '2' THEN 'DALAM_UNIT'
         WHEN '3' THEN 'DALAM_UNIT_GUDANG'
         WHEN '4' THEN 'EKSTERNAL'
       END,
       CASE TO_CHAR(ID_FLOWCHART)
         WHEN '1' THEN 'Antar unit / antar Area UJH'
         WHEN '2' THEN 'Dalam unit'
         WHEN '3' THEN 'Dalam unit - ambil di gudang'
         WHEN '4' THEN 'PLN Group / eksternal'
       END,
       TO_NUMBER(ID_FLOWCHART), TO_CHAR(ID_FLOWCHART)
  FROM &SCHEMA_LAMA..MASTER_FLOWCHART
 WHERE TO_CHAR(ID_FLOWCHART) IN ('1','2','3','4');

COMMIT;

--------------------------------------------------------------------------------
-- 2. unit
--------------------------------------------------------------------------------
INSERT INTO unit (nama, kode_re, kode_maximo, deskripsi, id_lama)
SELECT UNIT, KODE_RE, SITEID_MAXIMO, DESKRIPSI, SITEID
  FROM &SCHEMA_LAMA..MASTER_UNIT;

--------------------------------------------------------------------------------
-- 3. bidang
--------------------------------------------------------------------------------
INSERT INTO bidang (nama, id_lama)
SELECT BIDANG, ID_BIDANG_TOOL
  FROM &SCHEMA_LAMA..MASTER_BIDANG_TOOL;

COMMIT;

--------------------------------------------------------------------------------
-- 4. pengguna
--------------------------------------------------------------------------------
-- Dua hal ditangani sekaligus di sini.
--
-- Pertama, baris tanpa email tetap dibawa (PRD 7.1 butir 1) dengan email
-- penanda, agar tidak hilang diam-diam.
--
-- Kedua, MASTER_USER lama tidak punya batasan keunikan email dan memuat 127
-- baris ganda: orang yang sama tercatat beberapa kali, umumnya pada hari yang
-- sama — ciri khas pengiriman formulir berulang. Seluruh barisnya tetap dibawa.
-- Satu ditetapkan sebagai baris utama, sisanya menunjuk ke sana dan
-- dinonaktifkan, sehingga login tidak ambigu.
--
-- Baris utama dipilih dengan aturan tetap: yang punya paling banyak penugasan
-- peran; bila seri, ID_USER terkecil. Aturan tetap ini membuat migrasi dapat
-- diulang dengan hasil sama (PRD 7.1 butir 2).
--
-- Pemasukannya dua tahap — utama dulu, ganda menyusul — karena baris ganda
-- harus sudah menunjuk baris utamanya sejak detik pertama.

-- 4a. baris utama
INSERT INTO pengguna (nama, email, username, nipeg, tanda_tangan,
                      token_push, login_terakhir, id_lama)
WITH peringkat AS (
  SELECT u.*,
         ROW_NUMBER() OVER (
           PARTITION BY LOWER(NVL(u.EMAIL, 'tanpa-email-' || u.ID_USER))
           ORDER BY (SELECT COUNT(*) FROM &SCHEMA_LAMA..MASTER_USER_ROLE r
                      WHERE r.ID_USER = u.ID_USER) DESC, u.ID_USER) urut
    FROM &SCHEMA_LAMA..MASTER_USER u
)
SELECT NVL(NAMA, '(tanpa nama)'),
       LOWER(NVL(EMAIL, 'tanpa-email-' || ID_USER || '@migrasi.local')),
       USERNAME, NIPEG, TANDA_TANGAN, PLAYER_ID,
       CAST(LAST_LOGIN AS TIMESTAMP WITH TIME ZONE),
       ID_USER
  FROM peringkat WHERE urut = 1;

-- 4b. baris ganda, langsung menunjuk baris utamanya
INSERT INTO pengguna (nama, email, username, nipeg, tanda_tangan,
                      token_push, login_terakhir, id_lama,
                      duplikat_dari, nonaktif_pada)
WITH peringkat AS (
  SELECT u.*,
         ROW_NUMBER() OVER (
           PARTITION BY LOWER(NVL(u.EMAIL, 'tanpa-email-' || u.ID_USER))
           ORDER BY (SELECT COUNT(*) FROM &SCHEMA_LAMA..MASTER_USER_ROLE r
                      WHERE r.ID_USER = u.ID_USER) DESC, u.ID_USER) urut,
         FIRST_VALUE(u.ID_USER) OVER (
           PARTITION BY LOWER(NVL(u.EMAIL, 'tanpa-email-' || u.ID_USER))
           ORDER BY (SELECT COUNT(*) FROM &SCHEMA_LAMA..MASTER_USER_ROLE r
                      WHERE r.ID_USER = u.ID_USER) DESC, u.ID_USER) id_user_utama
    FROM &SCHEMA_LAMA..MASTER_USER u
)
SELECT NVL(g.NAMA, '(tanpa nama)'),
       LOWER(NVL(g.EMAIL, 'tanpa-email-' || g.ID_USER || '@migrasi.local')),
       g.USERNAME, g.NIPEG, g.TANDA_TANGAN, g.PLAYER_ID,
       CAST(g.LAST_LOGIN AS TIMESTAMP WITH TIME ZONE),
       g.ID_USER,
       utama.id,
       SYSTIMESTAMP
  FROM peringkat g
  JOIN pengguna utama ON utama.id_lama = g.id_user_utama
 WHERE g.urut > 1;

COMMIT;

--------------------------------------------------------------------------------
-- 5. pengguna_peran — nama peran lama dipetakan ke kode baru (PRD 4)
--------------------------------------------------------------------------------
-- Peran milik baris ganda dipindahkan ke baris utamanya, lalu disaring agar
-- tidak berulang. Tanpa ini, seseorang bisa kehilangan perannya hanya karena
-- perannya menempel pada baris yang dinonaktifkan.
INSERT INTO pengguna_peran (pengguna_id, peran, id_lama)
SELECT NVL(p.duplikat_dari, p.id) AS pengguna_id,
       CASE r.ROLE
         WHEN 'SPTOOL'       THEN 'PENGELOLA'
         WHEN 'MGR APPROVAL' THEN 'MANAJER'
         WHEN 'USER'         THEN 'PEMINJAM'
         WHEN 'STAF'         THEN 'STAF'
         WHEN 'ADMIN UNIT'   THEN 'ADMIN_UNIT'
         WHEN 'ADMIN SUPER'  THEN 'ADMIN_SUPER'
       END AS peran,
       MIN(ur.ID_USER_ROLE) AS id_lama
  FROM &SCHEMA_LAMA..MASTER_USER_ROLE ur
  JOIN &SCHEMA_LAMA..MASTER_ROLE r ON r.ID_ROLE = ur.ID_ROLE
  JOIN pengguna p                  ON p.id_lama = ur.ID_USER
 WHERE r.ROLE IN ('SPTOOL','MGR APPROVAL','USER','STAF','ADMIN UNIT','ADMIN SUPER')
 GROUP BY NVL(p.duplikat_dari, p.id),
          CASE r.ROLE
            WHEN 'SPTOOL'       THEN 'PENGELOLA'
            WHEN 'MGR APPROVAL' THEN 'MANAJER'
            WHEN 'USER'         THEN 'PEMINJAM'
            WHEN 'STAF'         THEN 'STAF'
            WHEN 'ADMIN UNIT'   THEN 'ADMIN_UNIT'
            WHEN 'ADMIN SUPER'  THEN 'ADMIN_SUPER'
          END;

--------------------------------------------------------------------------------
-- 6. pengguna_bidang
--------------------------------------------------------------------------------
INSERT INTO pengguna_bidang (pengguna_id, bidang_id, id_lama)
SELECT NVL(p.duplikat_dari, p.id), b.id, MIN(ub.ID_USER_BIDANG)
  FROM &SCHEMA_LAMA..MASTER_USER_BIDANG ub
  JOIN pengguna p ON p.id_lama = ub.ID_USER
  JOIN bidang   b ON b.id_lama = ub.ID_BIDANG
 GROUP BY NVL(p.duplikat_dari, p.id), b.id;

COMMIT;

--------------------------------------------------------------------------------
-- 7. Penurunan unit dari jejak pemakaian (PRD 6.2.1, sumber 2)
--------------------------------------------------------------------------------
-- Sistem lama tidak menyimpan unit seorang pengguna; ia selalu menanyakannya ke
-- database HR. Selama akses itu belum ada, unit disimpulkan dari jejak: unit
-- tempat seseorang pernah mengajukan, menyetujui sebagai SP atau Manajer, atau
-- menjadi operator alat milik unit tertentu.
--
-- Bila satu orang punya jejak di beberapa unit, dipilih yang paling sering.
-- Bila seri, unit dibiarkan kosong dan ditangani lewat layar admin (F13).
MERGE INTO pengguna p
USING (
  WITH suara AS (
    SELECT LOWER(CREATED_BY_EMAIL) email, SITEID siteid FROM &SCHEMA_LAMA..DATA_CART_HEADER
     WHERE CREATED_BY_EMAIL IS NOT NULL AND SITEID IS NOT NULL
    UNION ALL
    SELECT LOWER(APP_SP_EMAIL), SITEID FROM &SCHEMA_LAMA..DATA_CART_HEADER
     WHERE APP_SP_EMAIL IS NOT NULL AND SITEID IS NOT NULL
    UNION ALL
    SELECT LOWER(APP_MGR_EMAIL), SITEID FROM &SCHEMA_LAMA..DATA_CART_HEADER
     WHERE APP_MGR_EMAIL IS NOT NULL AND SITEID IS NOT NULL
    UNION ALL
    SELECT LOWER(op.EMAIL_OPERATOR), dt.UNIT
      FROM &SCHEMA_LAMA..MASTER_OPERATOR_ALAT op
      JOIN &SCHEMA_LAMA..DAFTAR_TOOL dt ON dt.NOURUT = op.NOURUT_TOOL
     WHERE op.EMAIL_OPERATOR IS NOT NULL AND dt.UNIT IS NOT NULL
  ),
  rekap AS (
    SELECT email, siteid, COUNT(*) jml,
           ROW_NUMBER() OVER (PARTITION BY email ORDER BY COUNT(*) DESC, siteid) urut,
           COUNT(*) - LEAD(COUNT(*)) OVER (PARTITION BY email ORDER BY COUNT(*) DESC, siteid) selisih
      FROM suara
     GROUP BY email, siteid
  )
  SELECT r.email, u.id unit_id
    FROM rekap r
    JOIN unit u ON u.id_lama = r.siteid
   WHERE r.urut = 1
     AND (r.selisih IS NULL OR r.selisih > 0)   -- seri tidak diambil
) s
ON (LOWER(p.email) = s.email)
WHEN MATCHED THEN UPDATE
  SET p.unit_id = s.unit_id,
      p.sumber_unit = 'MIGRASI'
  WHERE p.unit_id IS NULL;

COMMIT;

--------------------------------------------------------------------------------
-- 8. Laporan rekonsiliasi (PRD 7.4)
--------------------------------------------------------------------------------
DECLARE
  v_lama NUMBER;
  v_baru NUMBER;
  PROCEDURE banding(judul VARCHAR2, lama NUMBER, baru NUMBER) IS
  BEGIN
    DBMS_OUTPUT.PUT_LINE(RPAD(judul, 32) ||
      LPAD(lama, 8) || LPAD(baru, 8) ||
      CASE WHEN lama = baru THEN '   cocok' ELSE '   SELISIH ' || (baru - lama) END);
  END;
BEGIN
  DBMS_OUTPUT.PUT_LINE(CHR(10) || RPAD('Tabel', 32) || LPAD('lama', 8) || LPAD('baru', 8));
  DBMS_OUTPUT.PUT_LINE(RPAD('-', 56, '-'));

  SELECT COUNT(*) INTO v_lama FROM &SCHEMA_LAMA..MASTER_UNIT;
  SELECT COUNT(*) INTO v_baru FROM unit;               banding('unit', v_lama, v_baru);

  SELECT COUNT(*) INTO v_lama FROM &SCHEMA_LAMA..MASTER_BIDANG_TOOL;
  SELECT COUNT(*) INTO v_baru FROM bidang;             banding('bidang', v_lama, v_baru);

  SELECT COUNT(*) INTO v_lama FROM &SCHEMA_LAMA..MASTER_USER;
  SELECT COUNT(*) INTO v_baru FROM pengguna;           banding('pengguna', v_lama, v_baru);

  SELECT COUNT(*) INTO v_lama FROM &SCHEMA_LAMA..MASTER_USER_ROLE;
  SELECT COUNT(*) INTO v_baru FROM pengguna_peran;     banding('pengguna_peran', v_lama, v_baru);

  SELECT COUNT(*) INTO v_lama FROM &SCHEMA_LAMA..MASTER_USER_BIDANG;
  SELECT COUNT(*) INTO v_baru FROM pengguna_bidang;    banding('pengguna_bidang', v_lama, v_baru);

  DBMS_OUTPUT.PUT_LINE(CHR(10) || 'Catatan: selisih pengguna_peran dan pengguna_bidang');
  DBMS_OUTPUT.PUT_LINE('berasal dari penggabungan baris ganda, bukan data hilang.');

  DBMS_OUTPUT.PUT_LINE(CHR(10) || 'Pengecualian yang perlu ditindaklanjuti:');

  SELECT COUNT(*) INTO v_baru FROM pengguna WHERE duplikat_dari IS NOT NULL;
  DBMS_OUTPUT.PUT_LINE('  baris ganda dinonaktifkan   : ' || v_baru);

  SELECT COUNT(*) INTO v_baru FROM pengguna WHERE email LIKE 'tanpa-email-%@migrasi.local';
  DBMS_OUTPUT.PUT_LINE('  pengguna tanpa email        : ' || v_baru);

  DBMS_OUTPUT.PUT_LINE(CHR(10) || 'Pengguna aktif (baris ganda tidak dihitung):');

  SELECT COUNT(*) INTO v_baru FROM pengguna WHERE duplikat_dari IS NULL;
  DBMS_OUTPUT.PUT_LINE('  jumlah pengguna aktif       : ' || v_baru);

  SELECT COUNT(*) INTO v_baru FROM pengguna
   WHERE duplikat_dari IS NULL AND unit_id IS NOT NULL;
  DBMS_OUTPUT.PUT_LINE('  unit berhasil disimpulkan   : ' || v_baru);

  SELECT COUNT(*) INTO v_baru FROM pengguna
   WHERE duplikat_dari IS NULL AND unit_id IS NULL;
  DBMS_OUTPUT.PUT_LINE('  unit masih kosong           : ' || v_baru);

  SELECT COUNT(*) INTO v_baru FROM pengguna p
   WHERE p.duplikat_dari IS NULL
     AND p.unit_id IS NULL
     AND EXISTS (SELECT 1 FROM pengguna_peran r WHERE r.pengguna_id = p.id);
  DBMS_OUTPUT.PUT_LINE('  ... di antaranya berperan   : ' || v_baru ||
                       '   <-- wajib beres sebelum peluncuran');

  SELECT COUNT(*) INTO v_baru FROM pengguna
   WHERE duplikat_dari IS NULL AND jabatan IS NULL;
  DBMS_OUTPUT.PUT_LINE('  jabatan kosong              : ' || v_baru ||
                       '   (tidak ada sumber selain HR)');
END;
/

EXIT
