-- Migrasi Domain D — Utilitas peminjaman alat (PRD 7)
-- Dijalankan setelah 03_domain_c_peminjaman.sql.

SET SQLBLANKLINES ON
SET SERVEROUTPUT ON
DEFINE SCHEMA_LAMA = IPTOOLS

--------------------------------------------------------------------------------
-- 0. Kosongkan
--------------------------------------------------------------------------------
DELETE FROM penilaian_kondisi;
DELETE FROM kategori_kondisi;
DELETE FROM serah_terima_alat;
DELETE FROM serah_terima;
COMMIT;

--------------------------------------------------------------------------------
-- 1. kategori_kondisi
--------------------------------------------------------------------------------
INSERT INTO kategori_kondisi (grup, keterangan, bobot, nilai, id_lama)
SELECT GROUP_ID, KETERANGAN, BOBOT, NILAI, ID_RELIABILITY
  FROM &SCHEMA_LAMA..MASTER_RELIABILITY;

COMMIT;

--------------------------------------------------------------------------------
-- 2. serah_terima
--------------------------------------------------------------------------------
-- Arah diturunkan dari kolom TIPE. Bentuk selalu PENUH: serah terima ringkas
-- adalah aturan baru yang hanya berlaku untuk pengajuan baru (PRD 9.2.1), dan
-- 32 pengajuan alur "ambil di gudang" yang lama memang tidak pernah punya
-- dokumen serah terima sama sekali.
INSERT INTO serah_terima (
  peminjaman_id, arah, bentuk, surat_ke, status,
  nomor_kendaraan, jenis_kendaraan, pengemudi,
  dibuat_oleh, nama_pembuat_historis, dibuat_pada, diserahkan_pada, id_lama)
SELECT
  pm.id,
  CASE UPPER(NVL(sj.TIPE, 'SENT')) WHEN 'RETURN' THEN 'KEMBALI' ELSE 'KIRIM' END,
  'PENUH',
  NVL(sj.SURAT_KE, 0),
  CASE UPPER(NVL(sj.STATUS_SURAT_JALAN, 'DRAFT'))
    WHEN 'SENT'   THEN 'SENT'
    WHEN 'RETURN' THEN 'RETURN'
    WHEN 'DRAFT'  THEN 'DRAFT'
    ELSE 'DRAFT'
  END,
  sj.NOMOR_KENDARAAN, sj.JENIS_KENDARAAN, sj.PENGEMUDI,
  (SELECT p.id FROM pengguna p
    WHERE UPPER(TRIM(p.nama)) = UPPER(TRIM(sj.CREATED_BY))
      AND p.duplikat_dari IS NULL AND ROWNUM = 1),
  sj.CREATED_BY,
  CAST(NVL(sj.CREATED_DATE, SYSTIMESTAMP) AS TIMESTAMP WITH TIME ZONE),
  CASE WHEN UPPER(NVL(sj.STATUS_SURAT_JALAN,'')) <> 'DRAFT'
       THEN CAST(sj.CREATED_DATE AS TIMESTAMP WITH TIME ZONE) END,
  sj.ID_SURAT_JALAN
FROM &SCHEMA_LAMA..DATA_CART_SURAT_JALAN sj
JOIN peminjaman pm ON pm.id_lama = sj.ID_CART_HEADER;

COMMIT;

--------------------------------------------------------------------------------
-- 3. Foto kendaraan menjadi baris lampiran
--------------------------------------------------------------------------------
INSERT INTO lampiran (entitas, entitas_id, jenis, nama_berkas, urutan, id_lama)
SELECT 'SERAH_TERIMA', st.id, 'FOTO_KENDARAAN', g.berkas, g.urutan,
       'SURAT_JALAN.' || sj.ID_SURAT_JALAN || '.' || g.urutan
  FROM &SCHEMA_LAMA..DATA_CART_SURAT_JALAN sj
  JOIN serah_terima st ON st.id_lama = sj.ID_SURAT_JALAN
 CROSS JOIN LATERAL (
   SELECT sj.FOTO_KENDARAAN  berkas, 1 urutan FROM dual UNION ALL
   SELECT sj.FOTO_KENDARAAN2, 2 FROM dual UNION ALL
   SELECT sj.FOTO_KENDARAAN3, 3 FROM dual
 ) g
 WHERE g.berkas IS NOT NULL
   AND UPPER(TRIM(g.berkas)) NOT IN ('KOSONG','-','NULL');

COMMIT;

--------------------------------------------------------------------------------
-- 4. serah_terima_alat
--------------------------------------------------------------------------------
-- Alat dirujuk langsung, bukan lewat dua JOIN seperti sistem lama.
--
-- Baris yang statusnya menandakan sudah diterima diberi metode konfirmasi
-- 'MIGRASI': cara sebenarnya tidak tercatat di sistem lama, dan menuliskan
-- tebakan akan merusak nilai audit kolom itu.
INSERT INTO serah_terima_alat (
  serah_terima_id, peminjaman_alat_id, alat_id, status,
  metode_konfirmasi, dikonfirmasi_pada, dibuat_pada, id_lama)
SELECT
  st.id,
  pa.id,
  pa.alat_id,
  NVL(sjt.STATUS_SURAT_JALAN, 'DRAFT'),
  CASE WHEN pa.status IN ('DITERIMA','DIKEMBALIKAN','SELESAI') THEN 'MIGRASI' END,
  CASE WHEN pa.status IN ('DITERIMA','DIKEMBALIKAN','SELESAI') THEN pa.tanggal_terima END,
  CAST(NVL(sjt.CREATED_DATE, SYSTIMESTAMP) AS TIMESTAMP WITH TIME ZONE),
  sjt.ID_SURAT_JALAN_TOOL
FROM &SCHEMA_LAMA..DATA_CART_SURAT_JALAN_TOOL sjt
JOIN serah_terima st     ON st.id_lama = sjt.ID_SURAT_JALAN
JOIN peminjaman_alat pa  ON pa.id_lama = sjt.ID_CART_DETAIL;

COMMIT;

--------------------------------------------------------------------------------
-- 5. penilaian_kondisi — tabel terbesar
--------------------------------------------------------------------------------
INSERT INTO penilaian_kondisi (
  peminjaman_alat_id, kategori_id, tahap, keterangan,
  dinilai_oleh, nama_penilai_historis, dibuat_pada, id_lama)
SELECT
  pa.id,
  (SELECT k.id FROM kategori_kondisi k WHERE k.id_lama = rel.ID_RELIABIITY),
  CASE UPPER(NVL(rel.PROSES, 'SENT'))
    WHEN 'BOOKED'    THEN 'BOOKED'
    WHEN 'SENT'      THEN 'SENT'
    WHEN 'RETURN'    THEN 'RETURN'
    WHEN 'FINISH'    THEN 'FINISH'
    WHEN 'KERUSAKAN' THEN 'KERUSAKAN'
    ELSE 'SENT'
  END,
  rel.KETERANGAN,
  (SELECT p.id FROM pengguna p
    WHERE UPPER(TRIM(p.nama)) = UPPER(TRIM(rel.CREATED_BY))
      AND p.duplikat_dari IS NULL AND ROWNUM = 1),
  rel.CREATED_BY,
  CAST(NVL(rel.CREATED_DATE, SYSTIMESTAMP) AS TIMESTAMP WITH TIME ZONE),
  rel.ID_CART_DETAIL_RELIABILITY
FROM &SCHEMA_LAMA..DATA_CART_DETAIL_RELIABIITY rel
JOIN peminjaman_alat pa ON pa.id_lama = rel.ID_CART_DETAIL;

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

  SELECT COUNT(*) INTO v_lama FROM &SCHEMA_LAMA..MASTER_RELIABILITY;
  SELECT COUNT(*) INTO v_baru FROM kategori_kondisi;    banding('kategori_kondisi', v_lama, v_baru);

  SELECT COUNT(*) INTO v_lama FROM &SCHEMA_LAMA..DATA_CART_SURAT_JALAN;
  SELECT COUNT(*) INTO v_baru FROM serah_terima;        banding('serah_terima', v_lama, v_baru);

  SELECT COUNT(*) INTO v_lama FROM &SCHEMA_LAMA..DATA_CART_SURAT_JALAN_TOOL;
  SELECT COUNT(*) INTO v_baru FROM serah_terima_alat;   banding('serah_terima_alat', v_lama, v_baru);

  SELECT COUNT(*) INTO v_lama FROM &SCHEMA_LAMA..DATA_CART_DETAIL_RELIABIITY;
  SELECT COUNT(*) INTO v_baru FROM penilaian_kondisi;   banding('penilaian_kondisi', v_lama, v_baru);

  DBMS_OUTPUT.PUT_LINE(CHR(10) || 'Penjelasan selisih — baris tanpa induk:');

  SELECT COUNT(*) INTO v_baru FROM &SCHEMA_LAMA..DATA_CART_SURAT_JALAN sj
   WHERE NOT EXISTS (SELECT 1 FROM peminjaman pm WHERE pm.id_lama = sj.ID_CART_HEADER);
  DBMS_OUTPUT.PUT_LINE('  serah terima tanpa pengajuan: ' || v_baru);

  SELECT COUNT(*) INTO v_baru FROM &SCHEMA_LAMA..DATA_CART_SURAT_JALAN_TOOL sjt
   WHERE NOT EXISTS (SELECT 1 FROM serah_terima st WHERE st.id_lama = sjt.ID_SURAT_JALAN)
      OR NOT EXISTS (SELECT 1 FROM peminjaman_alat pa WHERE pa.id_lama = sjt.ID_CART_DETAIL);
  DBMS_OUTPUT.PUT_LINE('  baris alat tanpa induk      : ' || v_baru);

  SELECT COUNT(*) INTO v_baru FROM &SCHEMA_LAMA..DATA_CART_DETAIL_RELIABIITY rel
   WHERE NOT EXISTS (SELECT 1 FROM peminjaman_alat pa WHERE pa.id_lama = rel.ID_CART_DETAIL);
  DBMS_OUTPUT.PUT_LINE('  penilaian tanpa baris alat  : ' || v_baru);

  -- 105 di antaranya bertahap KERUSAKAN, dan 95 memang tidak menunjuk baris
  -- alat sama sekali — kaitannya lewat ID_KERUSAKAN. Baris itu ikut Domain E
  -- (laporan kerusakan), bukan domain ini.
  SELECT COUNT(*) INTO v_baru FROM &SCHEMA_LAMA..DATA_CART_DETAIL_RELIABIITY rel
   WHERE UPPER(NVL(rel.PROSES,'')) = 'KERUSAKAN'
     AND NOT EXISTS (SELECT 1 FROM peminjaman_alat pa WHERE pa.id_lama = rel.ID_CART_DETAIL);
  DBMS_OUTPUT.PUT_LINE('  ... bertahap KERUSAKAN      : ' || v_baru ||
                       '   <-- ditangani Domain E');

  DBMS_OUTPUT.PUT_LINE(CHR(10) || 'Sebaran penilaian kondisi per tahap:');
  FOR t IN (SELECT tahap, COUNT(*) jml FROM penilaian_kondisi GROUP BY tahap ORDER BY 2 DESC) LOOP
    DBMS_OUTPUT.PUT_LINE('  ' || RPAD(t.tahap, 12) || LPAD(t.jml, 8));
  END LOOP;

  DBMS_OUTPUT.PUT_LINE(CHR(10) || 'Pengecualian yang perlu ditindaklanjuti:');

  SELECT COUNT(*) INTO v_baru FROM penilaian_kondisi WHERE kategori_id IS NULL;
  DBMS_OUTPUT.PUT_LINE('  penilaian tanpa kategori    : ' || v_baru);

  SELECT COUNT(*) INTO v_baru FROM penilaian_kondisi WHERE dinilai_oleh IS NULL;
  DBMS_OUTPUT.PUT_LINE('  penilai tanpa akun cocok    : ' || v_baru);

  SELECT COUNT(*) INTO v_baru FROM serah_terima_alat WHERE metode_konfirmasi = 'MIGRASI';
  DBMS_OUTPUT.PUT_LINE('  konfirmasi bertanda MIGRASI : ' || v_baru ||
                       '   (cara aslinya tidak tercatat)');

  SELECT COUNT(*) INTO v_baru FROM serah_terima WHERE status = 'DRAFT';
  DBMS_OUTPUT.PUT_LINE('  serah terima masih draft    : ' || v_baru);
END;
/

EXIT
