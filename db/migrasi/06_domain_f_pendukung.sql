-- Migrasi Domain F — Pendukung (PRD 7)
-- Dijalankan setelah 05_domain_e_pemakaian.sql.

SET SQLBLANKLINES ON
SET SERVEROUTPUT ON
DEFINE SCHEMA_LAMA = IPTOOLS

--------------------------------------------------------------------------------
-- 0. Kosongkan
--------------------------------------------------------------------------------
DELETE FROM kuesioner_jawaban;
DELETE FROM kuesioner;
DELETE FROM pertanyaan_kuesioner;
DELETE FROM pesan;
DELETE FROM proyek;
COMMIT;

--------------------------------------------------------------------------------
-- 1. proyek
--------------------------------------------------------------------------------
INSERT INTO proyek (nama_pekerjaan, tanggal_mulai, tanggal_selesai, siteco,
                    tipe_oh_id, id_lama)
SELECT pr.NAMA_PEKERJAAN, pr.START_DATE, pr.END_DATE, pr.SITECO,
       (SELECT r.id FROM referensi r
         WHERE r.tipe = 'TIPE_OH' AND r.id_lama = TO_CHAR(pr.ID_TIPE_OH)),
       pr.NAMA_PEKERJAAN
  FROM &SCHEMA_LAMA..MASTER_DATA_PROJECT pr;

--------------------------------------------------------------------------------
-- 2. pertanyaan_kuesioner
--------------------------------------------------------------------------------
INSERT INTO pertanyaan_kuesioner (kategori, pertanyaan, urutan, dibuat_pada, id_lama)
SELECT pt.KATEGORI, NVL(pt.PERTANYAAN, '(tanpa teks)'), ROWNUM,
       CAST(NVL(pt.CREATED_DATE, SYSTIMESTAMP) AS TIMESTAMP WITH TIME ZONE),
       pt.ID_PERTANYAAN
  FROM &SCHEMA_LAMA..MASTER_PERTANYAAN pt;

COMMIT;

--------------------------------------------------------------------------------
-- 3. kuesioner
--------------------------------------------------------------------------------
INSERT INTO kuesioner (
  peminjaman_id, tanggal, nama_perusahaan, nama_unit, jenjang_jabatan,
  bidang_pekerjaan, unit_oh, jenis_inspeksi, status,
  pengisi_id, nama_pengisi_historis, dibuat_pada, id_lama)
SELECT
  (SELECT pm.id FROM peminjaman pm WHERE pm.id_lama = ks.ID_CART_HEADER),
  CAST(ks.TANGGAL_KUESIONER AS TIMESTAMP WITH TIME ZONE),
  ks.NAMA_PERUSAHAAN, ks.NAMA_UNIT, ks.JENJANG_JABATAN,
  ks.BIDANG_PEKERJAAN, ks.UNIT_OH, ks.JENIS_INSPEKSI,
  NVL(ks.STATUS, 'TIDAK DIKETAHUI'),
  (SELECT p.id FROM pengguna p
    WHERE LOWER(p.email) = LOWER(ks.EMAIL_CREATED_BY)
      AND p.duplikat_dari IS NULL AND ROWNUM = 1),
  ks.CREATED_BY,
  CAST(NVL(ks.TANGGAL_KUESIONER, SYSTIMESTAMP) AS TIMESTAMP WITH TIME ZONE),
  ks.ID_KUESIONER_HEADER
FROM &SCHEMA_LAMA..DATA_KUESIONER_HEADER ks;

--------------------------------------------------------------------------------
-- 4. kuesioner_jawaban
--------------------------------------------------------------------------------
INSERT INTO kuesioner_jawaban (
  kuesioner_id, pertanyaan_id, kepentingan, kinerja,
  penjawab_id, email_historis, dibuat_pada, id_lama)
SELECT k.id,
       (SELECT pt.id FROM pertanyaan_kuesioner pt WHERE pt.id_lama = jw.ID_PERTANYAAN),
       jw.JAWABAN_KEPENTINGAN, jw.JAWABAN_KINERJA,
       (SELECT p.id FROM pengguna p
         WHERE LOWER(p.email) = LOWER(jw.EMAIL)
           AND p.duplikat_dari IS NULL AND ROWNUM = 1),
       jw.EMAIL,
       CAST(NVL(jw.CREATED_DATE, SYSTIMESTAMP) AS TIMESTAMP WITH TIME ZONE),
       jw.ID_KUESIONER_JAWABAN
  FROM &SCHEMA_LAMA..DATA_KUESIONER_JAWABAN jw
  JOIN kuesioner k ON k.id_lama = jw.ID_KUESIONER_HEADER;

COMMIT;

--------------------------------------------------------------------------------
-- 5. pesan
--------------------------------------------------------------------------------
INSERT INTO pesan (dari_id, dari_email, ke_id, ke_email, isi, sudah_dibaca,
                   alat_id, peminjaman_id, dibuat_pada, id_lama)
SELECT
  (SELECT p.id FROM pengguna p WHERE LOWER(p.email) = LOWER(ch.FROM_EMAIL)
     AND p.duplikat_dari IS NULL AND ROWNUM = 1),
  ch.FROM_EMAIL,
  (SELECT p.id FROM pengguna p WHERE LOWER(p.email) = LOWER(ch.TO_EMAIL)
     AND p.duplikat_dari IS NULL AND ROWNUM = 1),
  ch.TO_EMAIL,
  ch.MESSAGE,
  CASE WHEN UPPER(NVL(ch.IS_SEEN,'NO')) IN ('YES','Y','1') THEN 1 ELSE 0 END,
  (SELECT a.id  FROM alat a       WHERE a.id_lama  = ch.NOURUT_TOOL),
  (SELECT pm.id FROM peminjaman pm WHERE pm.id_lama = ch.ID_CART_HEADER),
  CAST(NVL(ch.CREATED_DATE, SYSTIMESTAMP) AS TIMESTAMP WITH TIME ZONE),
  ch.ID_CHAT
FROM &SCHEMA_LAMA..CHATTING ch;

COMMIT;

--------------------------------------------------------------------------------
-- 6. Laporan rekonsiliasi
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

  SELECT COUNT(*) INTO v_lama FROM &SCHEMA_LAMA..MASTER_DATA_PROJECT;
  SELECT COUNT(*) INTO v_baru FROM proyek;              banding('proyek', v_lama, v_baru);

  SELECT COUNT(*) INTO v_lama FROM &SCHEMA_LAMA..MASTER_PERTANYAAN;
  SELECT COUNT(*) INTO v_baru FROM pertanyaan_kuesioner;
  banding('pertanyaan_kuesioner', v_lama, v_baru);

  SELECT COUNT(*) INTO v_lama FROM &SCHEMA_LAMA..DATA_KUESIONER_HEADER;
  SELECT COUNT(*) INTO v_baru FROM kuesioner;           banding('kuesioner', v_lama, v_baru);

  SELECT COUNT(*) INTO v_lama FROM &SCHEMA_LAMA..DATA_KUESIONER_JAWABAN;
  SELECT COUNT(*) INTO v_baru FROM kuesioner_jawaban;   banding('kuesioner_jawaban', v_lama, v_baru);

  SELECT COUNT(*) INTO v_lama FROM &SCHEMA_LAMA..CHATTING;
  SELECT COUNT(*) INTO v_baru FROM pesan;               banding('pesan', v_lama, v_baru);

  DBMS_OUTPUT.PUT_LINE(CHR(10) || 'Seluruh data lama setelah Domain A sampai F:');

  SELECT SUM(jml) INTO v_baru FROM (
    SELECT COUNT(*) jml FROM unit                   UNION ALL
    SELECT COUNT(*) FROM bidang                     UNION ALL
    SELECT COUNT(*) FROM referensi                  UNION ALL
    SELECT COUNT(*) FROM pengguna                   UNION ALL
    SELECT COUNT(*) FROM pengguna_peran             UNION ALL
    SELECT COUNT(*) FROM pengguna_bidang            UNION ALL
    SELECT COUNT(*) FROM alat                       UNION ALL
    SELECT COUNT(*) FROM alat_aksesoris             UNION ALL
    SELECT COUNT(*) FROM alat_sertifikat            UNION ALL
    SELECT COUNT(*) FROM alat_usulan_perubahan      UNION ALL
    SELECT COUNT(*) FROM alat_usulan_riwayat        UNION ALL
    SELECT COUNT(*) FROM lampiran                   UNION ALL
    SELECT COUNT(*) FROM keranjang                  UNION ALL
    SELECT COUNT(*) FROM peminjaman                 UNION ALL
    SELECT COUNT(*) FROM peminjaman_alat            UNION ALL
    SELECT COUNT(*) FROM peminjaman_alat_aksesoris  UNION ALL
    SELECT COUNT(*) FROM peminjaman_approval        UNION ALL
    SELECT COUNT(*) FROM peminjaman_riwayat         UNION ALL
    SELECT COUNT(*) FROM serah_terima               UNION ALL
    SELECT COUNT(*) FROM serah_terima_alat          UNION ALL
    SELECT COUNT(*) FROM kategori_kondisi           UNION ALL
    SELECT COUNT(*) FROM penilaian_kondisi          UNION ALL
    SELECT COUNT(*) FROM pemakaian_wo               UNION ALL
    SELECT COUNT(*) FROM pemakaian_wo_aktivitas     UNION ALL
    SELECT COUNT(*) FROM operator_alat              UNION ALL
    SELECT COUNT(*) FROM kerusakan                  UNION ALL
    SELECT COUNT(*) FROM kerusakan_persetujuan      UNION ALL
    SELECT COUNT(*) FROM kerusakan_mitra            UNION ALL
    SELECT COUNT(*) FROM proyek                     UNION ALL
    SELECT COUNT(*) FROM pertanyaan_kuesioner       UNION ALL
    SELECT COUNT(*) FROM kuesioner                  UNION ALL
    SELECT COUNT(*) FROM kuesioner_jawaban          UNION ALL
    SELECT COUNT(*) FROM pesan
  );
  DBMS_OUTPUT.PUT_LINE('  total baris di skema baru   : ' || v_baru);
  DBMS_OUTPUT.PUT_LINE('  (baris tambahan berasal dari kolom berulang yang menjadi baris:');
  DBMS_OUTPUT.PUT_LINE('   lampiran, kerusakan_persetujuan, dan peminjaman_approval)');
END;
/

EXIT
