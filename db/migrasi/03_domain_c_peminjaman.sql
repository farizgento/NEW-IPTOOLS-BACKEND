-- Migrasi Domain C — Data peminjaman alat (PRD 7)
-- Dijalankan setelah 02_domain_b_alat.sql.

SET SQLBLANKLINES ON
SET SERVEROUTPUT ON
DEFINE SCHEMA_LAMA = IPTOOLS

--------------------------------------------------------------------------------
-- 0. Kosongkan
--------------------------------------------------------------------------------
DELETE FROM peminjaman_riwayat;
DELETE FROM peminjaman_approval;
DELETE FROM peminjaman_alat_aksesoris;
DELETE FROM peminjaman_alat;
DELETE FROM peminjaman;
DELETE FROM keranjang;
COMMIT;

--------------------------------------------------------------------------------
-- 1. keranjang
--------------------------------------------------------------------------------
-- Baris yang menunjuk pengguna atau alat yang tidak ada tidak dapat dipindahkan
-- dan dihitung di laporan bagian 7.
INSERT INTO keranjang (pengguna_id, alat_id, dibuat_pada, id_lama)
SELECT p.id, a.id,
       CAST(NVL(d.CREATED_DATE, SYSTIMESTAMP) AS TIMESTAMP WITH TIME ZONE),
       MIN(d.ID_CART_DRAFT)
  FROM &SCHEMA_LAMA..DATA_CART_DRAFT d
  JOIN pengguna p ON LOWER(p.email) = LOWER(d.CREATED_EMAIL) AND p.duplikat_dari IS NULL
  JOIN alat a     ON a.id_lama = d.NOURUT_TOOL
 GROUP BY p.id, a.id, CAST(NVL(d.CREATED_DATE, SYSTIMESTAMP) AS TIMESTAMP WITH TIME ZONE);

COMMIT;

--------------------------------------------------------------------------------
-- 2. peminjaman
--------------------------------------------------------------------------------
-- FLOW dipetakan ke jenis alur. 302 pengajuan tidak punya FLOW sama sekali
-- (PRD 7.3): dibiarkan kosong dan dilaporkan, tidak ditebak.
INSERT INTO peminjaman (
  pekerjaan, unit_id, tanggal_mulai, tanggal_selesai, nomor_wo, tujuan, kontak,
  jenis_alur_id, tipe_oh_id, status,
  peminjam_id, nama_peminjam_historis, pengelola_historis,
  dibuat_pada, diubah_pada, id_lama)
SELECT
  h.PEKERJAAN,
  (SELECT u.id FROM unit u WHERE u.id_lama = h.SITEID),
  h.START_DATE,
  h.END_DATE,
  h.NOWO,
  h.TUJUAN,
  h.KONTAK,
  (SELECT r.id FROM referensi r
    WHERE r.tipe = 'JENIS_ALUR' AND r.id_lama = TO_CHAR(h.FLOW)),
  (SELECT r.id FROM referensi r
    WHERE r.tipe = 'TIPE_OH' AND r.id_lama = TO_CHAR(h.TIPE_OH)),
  NVL(h.STATUS, 'TIDAK DIKETAHUI'),
  (SELECT p.id FROM pengguna p
    WHERE LOWER(p.email) = LOWER(h.CREATED_BY_EMAIL) AND p.duplikat_dari IS NULL
      AND ROWNUM = 1),
  h.CREATED_BY,
  h.STAF_TOOL,
  CAST(NVL(h.CREATED_DATE, SYSTIMESTAMP) AS TIMESTAMP WITH TIME ZONE),
  CAST(h.UPDATED_DATE AS TIMESTAMP WITH TIME ZONE),
  h.ID_CART_HEADER
FROM &SCHEMA_LAMA..DATA_CART_HEADER h;

COMMIT;

--------------------------------------------------------------------------------
-- 3. peminjaman_alat
--------------------------------------------------------------------------------
-- Sepuluh kode angka dipetakan ke nilai bernama sesuai padanan PRD 6.4.1.
-- Perhatikan bahwa kode 0, 5, dan 6 menandai kemajuan pengisian penilaian
-- kondisi, bukan kemajuan serah terima — di sistem lama keduanya berbagi satu
-- kolom dan saling menimpa. Pemetaan di bawah memilih tahap serah terima yang
-- paling awal yang pasti sudah terlewati oleh kode itu.
INSERT INTO peminjaman_alat (
  peminjaman_id, alat_id, status, kode_status_lama,
  jumlah_uji, keterangan_uji,
  tanggal_kirim, tanggal_terima, tanggal_kembali, tanggal_selesai,
  pengelola_historis, dibuat_pada, id_lama)
SELECT
  pm.id,
  (SELECT a.id FROM alat a WHERE a.id_lama = d.NOURUT_TOOL),
  CASE d.STATUS
    WHEN 0 THEN 'DIAJUKAN'            -- sudah isi penilaian kirim
    WHEN 1 THEN 'DITERIMA'
    WHEN 2 THEN 'DIKEMBALIKAN'
    WHEN 3 THEN 'SELESAI'
    WHEN 4 THEN 'MASUK_SERAH_TERIMA'
    WHEN 5 THEN 'DIKEMBALIKAN'        -- sudah isi penilaian kembali
    WHEN 6 THEN 'SELESAI'             -- sudah isi penilaian selesai
    WHEN 7 THEN 'DIKIRIM'
    WHEN 8 THEN 'DIKIRIM'             -- alur ambil di gudang: siap digunakan
    WHEN 9 THEN 'DITERIMA'            -- alur ambil di gudang: sudah diterima
    ELSE 'DIAJUKAN'
  END,
  d.STATUS,
  d.JML_UJI,
  d.KET_JML_UJI,
  CAST(d.TANGGAL_KIRIM AS TIMESTAMP WITH TIME ZONE),
  CAST(d.TGL_TERIMA    AS TIMESTAMP WITH TIME ZONE),
  CAST(NVL(d.TANGGAL_KEMBALI, CAST(d.TGL_KEMBALI AS TIMESTAMP))
       AS TIMESTAMP WITH TIME ZONE),
  CAST(d.TGL_FINISH    AS TIMESTAMP WITH TIME ZONE),
  d.STAF_TOOL,
  CAST(NVL(d.CREATED_DATE, SYSTIMESTAMP) AS TIMESTAMP WITH TIME ZONE),
  d.ID_CART_DETAIL
FROM &SCHEMA_LAMA..DATA_CART_DETAIL d
JOIN peminjaman pm ON pm.id_lama = d.ID_CART_HEADER;

COMMIT;

--------------------------------------------------------------------------------
-- 4. peminjaman_alat_aksesoris
--------------------------------------------------------------------------------
INSERT INTO peminjaman_alat_aksesoris (
  peminjaman_alat_id, alat_aksesoris_id, ikut_dikirim, dibuat_pada, id_lama)
SELECT pa.id,
       (SELECT ak.id FROM alat_aksesoris ak WHERE ak.id_lama = x.NOURUT_AKSESORIS),
       CASE WHEN UPPER(NVL(x.IS_SENT, 'NO')) IN ('YES','Y','1') THEN 1 ELSE 0 END,
       CAST(NVL(x.CREATED_DATE, SYSTIMESTAMP) AS TIMESTAMP WITH TIME ZONE),
       x.ID_CART_DETAIL_AKSESORIS
  FROM &SCHEMA_LAMA..DATA_CART_DETAIL_AKSESORIS x
  JOIN peminjaman_alat pa ON pa.id_lama = x.ID_CART_DETAIL;

COMMIT;

--------------------------------------------------------------------------------
-- 5. peminjaman_riwayat
--------------------------------------------------------------------------------
-- Status lama diisi dari baris sebelumnya pada pengajuan yang sama.
INSERT INTO peminjaman_riwayat (
  peminjaman_id, status_lama, status_baru, keterangan, oleh, nama_historis,
  dibuat_pada, id_lama)
SELECT pm.id,
       LAG(l.STATUS) OVER (PARTITION BY l.ID_CART_HEADER
                           ORDER BY l.CREATED_DATE, l.ID_LOG),
       NVL(l.STATUS, 'TIDAK DIKETAHUI'),
       l.KETERANGAN,
       (SELECT p.id FROM pengguna p
         WHERE UPPER(TRIM(p.nama)) = UPPER(TRIM(l.CREATED_BY))
           AND p.duplikat_dari IS NULL AND ROWNUM = 1),
       l.CREATED_BY,
       CAST(NVL(l.CREATED_DATE, SYSTIMESTAMP) AS TIMESTAMP WITH TIME ZONE),
       l.ID_LOG
  FROM &SCHEMA_LAMA..LOG_STATUS_PEMINJAMAN l
  JOIN peminjaman pm ON pm.id_lama = l.ID_CART_HEADER;

COMMIT;

--------------------------------------------------------------------------------
-- 6. peminjaman_approval — disusun ulang
--------------------------------------------------------------------------------
-- Sistem lama menyimpan approval sebagai delapan kolom di header, dan hanya
-- menyimpan keputusan terakhir per tingkat. Baris di bawah disusun kembali dari
-- kolom-kolom itu dan ditandai disusun_ulang = 1 (PRD 7.3).
--
-- Tahap PENGELOLA selalu ada. Tahap MANAJER hanya dibuat untuk alur yang
-- memang menuntutnya menurut SK: antar unit/Area UJH dan eksternal. Alur dalam
-- unit dan ambil di gudang berhenti di pengelola (PRD 9.1).

-- 6a. tahap pengelola
INSERT INTO peminjaman_approval (
  peminjaman_id, urutan, tahap, keputusan, penyetuju_id,
  nama_penyetuju_historis, diputuskan_pada, disusun_ulang)
SELECT pm.id, 1, 'PENGELOLA',
       CASE
         WHEN h.TGL_REJECT_SP  IS NOT NULL THEN 'TOLAK'
         WHEN h.TGL_APPROVE_SP IS NOT NULL THEN 'SETUJU'
         ELSE 'MENUNGGU'
       END,
       (SELECT p.id FROM pengguna p
         WHERE LOWER(p.email) = LOWER(h.APP_SP_EMAIL) AND p.duplikat_dari IS NULL
           AND ROWNUM = 1),
       h.APP_SP_NAMA,
       CAST(NVL(h.TGL_REJECT_SP, h.TGL_APPROVE_SP) AS TIMESTAMP WITH TIME ZONE),
       1
  FROM &SCHEMA_LAMA..DATA_CART_HEADER h
  JOIN peminjaman pm ON pm.id_lama = h.ID_CART_HEADER;

-- 6b. tahap manajer, hanya untuk alur yang menuntutnya
INSERT INTO peminjaman_approval (
  peminjaman_id, urutan, tahap, keputusan, penyetuju_id,
  nama_penyetuju_historis, diputuskan_pada, disusun_ulang)
SELECT pm.id, 2, 'MANAJER',
       CASE
         WHEN h.TGL_REJECT_MGR  IS NOT NULL THEN 'TOLAK'
         WHEN h.TGL_APPROVE_MGR IS NOT NULL THEN 'SETUJU'
         ELSE 'MENUNGGU'
       END,
       (SELECT p.id FROM pengguna p
         WHERE LOWER(p.email) = LOWER(h.APP_MGR_EMAIL) AND p.duplikat_dari IS NULL
           AND ROWNUM = 1),
       h.APP_MGR_NAMA,
       CAST(NVL(h.TGL_REJECT_MGR, h.TGL_APPROVE_MGR) AS TIMESTAMP WITH TIME ZONE),
       1
  FROM &SCHEMA_LAMA..DATA_CART_HEADER h
  JOIN peminjaman pm ON pm.id_lama = h.ID_CART_HEADER
 WHERE TO_CHAR(h.FLOW) IN ('1','4')            -- antar unit/Area UJH, eksternal
    OR h.TGL_APPROVE_MGR IS NOT NULL           -- atau memang pernah diputuskan
    OR h.TGL_REJECT_MGR  IS NOT NULL;

COMMIT;

--------------------------------------------------------------------------------
-- 7. Laporan rekonsiliasi
--------------------------------------------------------------------------------
DECLARE
  v_lama NUMBER;
  v_baru NUMBER;
  PROCEDURE banding(judul VARCHAR2, lama NUMBER, baru NUMBER) IS
  BEGIN
    DBMS_OUTPUT.PUT_LINE(RPAD(judul, 32) || LPAD(lama, 8) || LPAD(baru, 8) ||
      CASE WHEN lama = baru THEN '   cocok' ELSE '   SELISIH ' || (baru - lama) END);
  END;
BEGIN
  DBMS_OUTPUT.PUT_LINE(CHR(10) || RPAD('Tabel', 32) || LPAD('lama', 8) || LPAD('baru', 8));
  DBMS_OUTPUT.PUT_LINE(RPAD('-', 56, '-'));

  SELECT COUNT(*) INTO v_lama FROM &SCHEMA_LAMA..DATA_CART_HEADER;
  SELECT COUNT(*) INTO v_baru FROM peminjaman;             banding('peminjaman', v_lama, v_baru);

  SELECT COUNT(*) INTO v_lama FROM &SCHEMA_LAMA..DATA_CART_DETAIL;
  SELECT COUNT(*) INTO v_baru FROM peminjaman_alat;        banding('peminjaman_alat', v_lama, v_baru);

  SELECT COUNT(*) INTO v_lama FROM &SCHEMA_LAMA..DATA_CART_DETAIL_AKSESORIS;
  SELECT COUNT(*) INTO v_baru FROM peminjaman_alat_aksesoris;
  banding('peminjaman_alat_aksesoris', v_lama, v_baru);

  SELECT COUNT(*) INTO v_lama FROM &SCHEMA_LAMA..LOG_STATUS_PEMINJAMAN;
  SELECT COUNT(*) INTO v_baru FROM peminjaman_riwayat;     banding('peminjaman_riwayat', v_lama, v_baru);

  SELECT COUNT(*) INTO v_lama FROM &SCHEMA_LAMA..DATA_CART_DRAFT;
  SELECT COUNT(*) INTO v_baru FROM keranjang;              banding('keranjang', v_lama, v_baru);

  -- Setiap selisih di atas harus punya penjelasan bernama (PRD 7.4).
  DBMS_OUTPUT.PUT_LINE(CHR(10) || 'Penjelasan selisih — baris tanpa induk:');

  SELECT COUNT(*) INTO v_baru FROM &SCHEMA_LAMA..DATA_CART_DETAIL d
   WHERE NOT EXISTS (SELECT 1 FROM &SCHEMA_LAMA..DATA_CART_HEADER h
                      WHERE h.ID_CART_HEADER = d.ID_CART_HEADER);
  DBMS_OUTPUT.PUT_LINE('  detail tanpa pengajuan      : ' || v_baru);

  SELECT COUNT(*) INTO v_baru FROM &SCHEMA_LAMA..DATA_CART_DETAIL_AKSESORIS x
   WHERE NOT EXISTS (SELECT 1 FROM peminjaman_alat pa WHERE pa.id_lama = x.ID_CART_DETAIL);
  DBMS_OUTPUT.PUT_LINE('  aksesoris tanpa baris alat  : ' || v_baru);

  SELECT COUNT(*) INTO v_baru FROM &SCHEMA_LAMA..LOG_STATUS_PEMINJAMAN l
   WHERE NOT EXISTS (SELECT 1 FROM &SCHEMA_LAMA..DATA_CART_HEADER h
                      WHERE h.ID_CART_HEADER = l.ID_CART_HEADER);
  DBMS_OUTPUT.PUT_LINE('  riwayat tanpa pengajuan     : ' || v_baru);

  DBMS_OUTPUT.PUT_LINE(CHR(10) || 'Rantai approval yang disusun ulang:');
  SELECT COUNT(*) INTO v_baru FROM peminjaman_approval;
  DBMS_OUTPUT.PUT_LINE('  jumlah baris approval       : ' || v_baru);
  SELECT COUNT(*) INTO v_baru FROM peminjaman_approval WHERE tahap = 'PENGELOLA';
  DBMS_OUTPUT.PUT_LINE('  ... tahap pengelola         : ' || v_baru);
  SELECT COUNT(*) INTO v_baru FROM peminjaman_approval WHERE tahap = 'MANAJER';
  DBMS_OUTPUT.PUT_LINE('  ... tahap manajer           : ' || v_baru);
  SELECT COUNT(*) INTO v_baru FROM peminjaman_approval WHERE keputusan = 'MENUNGGU';
  DBMS_OUTPUT.PUT_LINE('  ... masih menunggu          : ' || v_baru);
  SELECT COUNT(*) INTO v_baru FROM peminjaman_approval WHERE penyetuju_id IS NULL
     AND nama_penyetuju_historis IS NOT NULL;
  DBMS_OUTPUT.PUT_LINE('  penyetuju tanpa akun cocok  : ' || v_baru);

  DBMS_OUTPUT.PUT_LINE(CHR(10) || 'Pengecualian yang perlu ditindaklanjuti:');

  SELECT COUNT(*) INTO v_baru FROM peminjaman WHERE jenis_alur_id IS NULL;
  DBMS_OUTPUT.PUT_LINE('  peminjaman tanpa jenis alur : ' || v_baru);

  SELECT COUNT(*) INTO v_baru FROM peminjaman WHERE peminjam_id IS NULL;
  DBMS_OUTPUT.PUT_LINE('  peminjam tanpa akun cocok   : ' || v_baru);

  SELECT COUNT(*) INTO v_baru FROM peminjaman WHERE unit_id IS NULL;
  DBMS_OUTPUT.PUT_LINE('  peminjaman tanpa unit       : ' || v_baru);

  SELECT COUNT(*) INTO v_baru FROM peminjaman_alat WHERE alat_id IS NULL;
  DBMS_OUTPUT.PUT_LINE('  baris alat tanpa alat       : ' || v_baru);

  SELECT COUNT(*) INTO v_baru FROM peminjaman_riwayat WHERE oleh IS NULL;
  DBMS_OUTPUT.PUT_LINE('  riwayat tanpa pelaku cocok  : ' || v_baru);

  SELECT COUNT(*) INTO v_baru
    FROM &SCHEMA_LAMA..DATA_CART_DRAFT d
   WHERE NOT EXISTS (SELECT 1 FROM pengguna p
                      WHERE LOWER(p.email) = LOWER(d.CREATED_EMAIL)
                        AND p.duplikat_dari IS NULL);
  DBMS_OUTPUT.PUT_LINE('  keranjang tanpa pemilik     : ' || v_baru);
END;
/

EXIT
