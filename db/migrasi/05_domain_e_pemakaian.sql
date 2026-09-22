-- Migrasi Domain E — Utilitas pemakaian alat (PRD 7)
-- Dijalankan setelah 04_domain_d_serah_terima.sql.

SET SQLBLANKLINES ON
SET SERVEROUTPUT ON
DEFINE SCHEMA_LAMA = IPTOOLS

--------------------------------------------------------------------------------
-- 0. Kosongkan
--------------------------------------------------------------------------------
DELETE FROM penilaian_kondisi WHERE kerusakan_ref IS NOT NULL;
DELETE FROM kerusakan_mitra;
DELETE FROM kerusakan_persetujuan;
DELETE FROM lampiran WHERE entitas = 'KERUSAKAN';
DELETE FROM kerusakan;
DELETE FROM operator_alat;
DELETE FROM pemakaian_wo_aktivitas;
DELETE FROM pemakaian_wo;
COMMIT;

--------------------------------------------------------------------------------
-- 1. pemakaian_wo dan aktivitasnya
--------------------------------------------------------------------------------
INSERT INTO pemakaian_wo (peminjaman_id, nomor_wo, siteid_maximo,
                          dibuat_oleh, nama_pembuat_historis, dibuat_pada, id_lama)
SELECT pm.id, wo.WONUM, wo.SITEID_MAXIMO,
       (SELECT p.id FROM pengguna p
         WHERE UPPER(TRIM(p.nama)) = UPPER(TRIM(wo.CREATED_BY))
           AND p.duplikat_dari IS NULL AND ROWNUM = 1),
       wo.CREATED_BY,
       CAST(NVL(wo.CREATED_DATE, SYSTIMESTAMP) AS TIMESTAMP WITH TIME ZONE),
       wo.ID_CART_WO
  FROM &SCHEMA_LAMA..DATA_CART_WO wo
  JOIN peminjaman pm ON pm.id_lama = wo.ID_CART_HEADER;

-- Aktivitas yang tidak menunjuk work order tetap dibawa, disambungkan ke
-- pengajuannya. Membuangnya berarti kehilangan 2.794 dari 3.183 baris.
INSERT INTO pemakaian_wo_aktivitas (wo_id, peminjaman_id, kode_task, deskripsi,
                                    estimasi_jam, dibuat_pada, id_lama)
SELECT (SELECT w.id  FROM pemakaian_wo w WHERE w.id_lama  = ak.ID_CART_WO),
       (SELECT pm.id FROM peminjaman pm  WHERE pm.id_lama = ak.ID_CART_HEADER),
       ak.TASKID, ak.DESCRIPTION, ak.ESTDUR,
       CAST(NVL(ak.CREATED_DATE, SYSTIMESTAMP) AS TIMESTAMP WITH TIME ZONE),
       ak.ID_CART_WO_ACTIVITY
  FROM &SCHEMA_LAMA..DATA_CART_WO_ACTIVITY ak
 WHERE EXISTS (SELECT 1 FROM pemakaian_wo w WHERE w.id_lama  = ak.ID_CART_WO)
    OR EXISTS (SELECT 1 FROM peminjaman pm  WHERE pm.id_lama = ak.ID_CART_HEADER);

COMMIT;

--------------------------------------------------------------------------------
-- 2. operator_alat
--------------------------------------------------------------------------------
INSERT INTO operator_alat (alat_id, pengguna_id, email_historis, kode_maximo,
                           dibuat_pada, id_lama)
SELECT a.id,
       (SELECT p.id FROM pengguna p
         WHERE LOWER(p.email) = LOWER(op.EMAIL_OPERATOR)
           AND p.duplikat_dari IS NULL AND ROWNUM = 1),
       op.EMAIL_OPERATOR,
       op.KODE_MAXIMO,
       CAST(NVL(op.CREATED_DATE, SYSTIMESTAMP) AS TIMESTAMP WITH TIME ZONE),
       op.ID_OPERATOR
  FROM &SCHEMA_LAMA..MASTER_OPERATOR_ALAT op
  JOIN alat a ON a.id_lama = op.NOURUT_TOOL;

COMMIT;

--------------------------------------------------------------------------------
-- 3. kerusakan
--------------------------------------------------------------------------------
INSERT INTO kerusakan (
  alat_id, peminjaman_id, peminjaman_alat_id,
  pelapor_id, nama_pelapor_historis, tanggal_lapor,
  lokasi, pekerjaan, detail, investigasi_awal, tingkat,
  tipe_perbaikan, waktu_penyelesaian, jumlah_uji, keterangan_approval,
  tanggal_penghapusan, pic_id, nama_pic_historis, status, dibuat_pada, id_lama)
SELECT
  (SELECT a.id  FROM alat a             WHERE a.id_lama  = kr.NOURUT_TOOL),
  (SELECT pm.id FROM peminjaman pm      WHERE pm.id_lama = kr.ID_CART_HEADER),
  (SELECT pa.id FROM peminjaman_alat pa WHERE pa.id_lama = kr.ID_CART_DETAIL),
  (SELECT p.id FROM pengguna p
    WHERE LOWER(p.email) = LOWER(kr.EMAIL_PELAPOR)
      AND p.duplikat_dari IS NULL AND ROWNUM = 1),
  kr.PELAPOR,
  CAST(kr.TANGGAL_LAPOR AS TIMESTAMP WITH TIME ZONE),
  kr.LOKASI_KERUSAKAN, kr.PEKERJAAN, kr.DETAIL_KERUSAKAN, kr.INVESTIGASI_AWAL,
  kr.LEVEL_KERUSAKAN, kr.TIPE_PERBAIKAN, kr.WAKTU_PENYELESAIAN,
  kr.JUMLAH_UJI, kr.KETERANGAN_APP,
  CAST(kr.TANGGAL_PENGHAPUSAN AS TIMESTAMP WITH TIME ZONE),
  (SELECT p.id FROM pengguna p
    WHERE LOWER(p.email) = LOWER(kr.EMAIL_PIC)
      AND p.duplikat_dari IS NULL AND ROWNUM = 1),
  kr.PIC_TOOL,
  NVL(kr.STATUS, 'TIDAK DIKETAHUI'),
  CAST(NVL(kr.TANGGAL_LAPOR, SYSTIMESTAMP) AS TIMESTAMP WITH TIME ZONE),
  kr.ID_KERUSAKAN_TOOL
FROM &SCHEMA_LAMA..DATA_KERUSAKAN_TOOL kr;

COMMIT;

--------------------------------------------------------------------------------
-- 4. kerusakan_persetujuan — empat kelompok kolom menjadi baris
--------------------------------------------------------------------------------
INSERT INTO kerusakan_persetujuan (
  kerusakan_id, urutan, peran, pengguna_id,
  nama_historis, email_historis, disetujui_pada)
SELECT k.id, x.urutan, x.peran,
       (SELECT p.id FROM pengguna p
         WHERE LOWER(p.email) = LOWER(x.email)
           AND p.duplikat_dari IS NULL AND ROWNUM = 1),
       x.nama, x.email, CAST(x.tanggal AS TIMESTAMP WITH TIME ZONE)
  FROM &SCHEMA_LAMA..DATA_KERUSAKAN_TOOL kr
  JOIN kerusakan k ON k.id_lama = kr.ID_KERUSAKAN_TOOL
 CROSS JOIN LATERAL (
   SELECT 1 urutan, 'MENGETAHUI' peran, kr.MENGETAHUI1 nama,
          kr.EMAIL_MENGETAHUI1 email, kr.TANGGAL_MENGETAHUI1 tanggal FROM dual
   UNION ALL
   SELECT 2, 'MENGETAHUI', kr.MENGETAHUI2, kr.EMAIL_MENGETAHUI2, kr.TANGGAL_MENGETAHUI2 FROM dual
   UNION ALL
   SELECT 3, 'MENGETAHUI', kr.MENGETAHUI3, kr.EMAIL_MENGETAHUI3, kr.TANGGAL_MENGETAHUI3 FROM dual
   UNION ALL
   SELECT 4, 'MANAJER', kr.MANAJER_APPR, kr.EMAIL_MANAJER_APPR, kr.TANGGAL_MANAJER_APPR FROM dual
 ) x
 WHERE x.nama IS NOT NULL OR x.email IS NOT NULL;

COMMIT;

--------------------------------------------------------------------------------
-- 5. Tujuh kolom dokumen menjadi baris lampiran
--------------------------------------------------------------------------------
INSERT INTO lampiran (entitas, entitas_id, jenis, nama_berkas, id_lama)
SELECT 'KERUSAKAN', k.id, d.jenis, d.berkas,
       'KERUSAKAN.' || kr.ID_KERUSAKAN_TOOL || '.' || d.jenis
  FROM &SCHEMA_LAMA..DATA_KERUSAKAN_TOOL kr
  JOIN kerusakan k ON k.id_lama = kr.ID_KERUSAKAN_TOOL
 CROSS JOIN LATERAL (
   SELECT 'LAP_INVESTIGASI'  jenis, kr.DOKUMEN_LAP_INVESTIGASI  berkas FROM dual UNION ALL
   SELECT 'IH',               kr.DOKUMEN_IH               FROM dual UNION ALL
   SELECT 'DAILY_REPORT',     kr.DOKUMEN_DAILY_REPORT     FROM dual UNION ALL
   SELECT 'SURAT_JALAN',      kr.DOKUMEN_SURAT_JALAN      FROM dual UNION ALL
   SELECT 'LAP_COMMISIONING', kr.DOKUMEN_LAP_COMMISIONING FROM dual UNION ALL
   SELECT 'BA',               kr.DOKUMEN_BA               FROM dual UNION ALL
   SELECT 'LAP_PERBAIKAN',    kr.DOKUMEN_LAP_PERBAIKAN    FROM dual
 ) d
 WHERE d.berkas IS NOT NULL
   AND UPPER(TRIM(d.berkas)) NOT IN ('KOSONG','-','NULL');

INSERT INTO lampiran (entitas, entitas_id, jenis, nama_berkas, id_lama)
SELECT 'KERUSAKAN', k.id, 'FOTO', f.FOTO, 'KERUSAKAN_FOTO.' || f.ID_KERUSAKAN_FOTO
  FROM &SCHEMA_LAMA..DATA_KERUSAKAN_FOTO f
  JOIN kerusakan k ON k.id_lama = f.ID_KERUSAKAN_TOOL
 WHERE f.FOTO IS NOT NULL;

COMMIT;

--------------------------------------------------------------------------------
-- 6. kerusakan_mitra
--------------------------------------------------------------------------------
INSERT INTO kerusakan_mitra (kerusakan_id, nama_vendor, alamat, npwp, pic, email,
                             tipe_po, nomor_po, status, dibuat_pada, id_lama)
SELECT k.id, m.NAMA_VENDOR, m.ALAMAT, m.NPWP, m.PIC, m.EMAIL,
       m.TIPE_PO, m.NO_PO, m.STATUS,
       CAST(NVL(m.CREATED_DATE, SYSTIMESTAMP) AS TIMESTAMP WITH TIME ZONE),
       m.ID_KERUSAKAN_MITRA
  FROM &SCHEMA_LAMA..DATA_KERUSAKAN_MITRA m
  JOIN kerusakan k ON k.id_lama = m.ID_KERUSAKAN_TOOL;

COMMIT;

--------------------------------------------------------------------------------
-- 7. Penilaian kondisi bertahap KERUSAKAN
--------------------------------------------------------------------------------
-- Baris ini tertinggal pada Domain D karena menunjuk laporan kerusakan, bukan
-- baris alat. Sekarang laporannya sudah ada, jadi dapat dipindahkan.
INSERT INTO penilaian_kondisi (
  peminjaman_alat_id, kerusakan_ref, kategori_id, tahap, keterangan,
  dinilai_oleh, nama_penilai_historis, dibuat_pada, id_lama)
SELECT
  (SELECT pa.id FROM peminjaman_alat pa WHERE pa.id_lama = rel.ID_CART_DETAIL),
  k.id,
  (SELECT kk.id FROM kategori_kondisi kk WHERE kk.id_lama = rel.ID_RELIABIITY),
  'KERUSAKAN',
  rel.KETERANGAN,
  (SELECT p.id FROM pengguna p
    WHERE UPPER(TRIM(p.nama)) = UPPER(TRIM(rel.CREATED_BY))
      AND p.duplikat_dari IS NULL AND ROWNUM = 1),
  rel.CREATED_BY,
  CAST(NVL(rel.CREATED_DATE, SYSTIMESTAMP) AS TIMESTAMP WITH TIME ZONE),
  rel.ID_CART_DETAIL_RELIABILITY
FROM &SCHEMA_LAMA..DATA_CART_DETAIL_RELIABIITY rel
JOIN kerusakan k ON k.id_lama = rel.ID_KERUSAKAN
WHERE NOT EXISTS (SELECT 1 FROM penilaian_kondisi pk
                   WHERE pk.id_lama = rel.ID_CART_DETAIL_RELIABILITY);

COMMIT;

--------------------------------------------------------------------------------
-- 8. Laporan rekonsiliasi
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

  SELECT COUNT(*) INTO v_lama FROM &SCHEMA_LAMA..DATA_CART_WO;
  SELECT COUNT(*) INTO v_baru FROM pemakaian_wo;          banding('pemakaian_wo', v_lama, v_baru);

  SELECT COUNT(*) INTO v_lama FROM &SCHEMA_LAMA..DATA_CART_WO_ACTIVITY;
  SELECT COUNT(*) INTO v_baru FROM pemakaian_wo_aktivitas;
  banding('pemakaian_wo_aktivitas', v_lama, v_baru);

  SELECT COUNT(*) INTO v_lama FROM &SCHEMA_LAMA..MASTER_OPERATOR_ALAT;
  SELECT COUNT(*) INTO v_baru FROM operator_alat;         banding('operator_alat', v_lama, v_baru);

  SELECT COUNT(*) INTO v_lama FROM &SCHEMA_LAMA..DATA_KERUSAKAN_TOOL;
  SELECT COUNT(*) INTO v_baru FROM kerusakan;             banding('kerusakan', v_lama, v_baru);

  SELECT COUNT(*) INTO v_lama FROM &SCHEMA_LAMA..DATA_KERUSAKAN_MITRA;
  SELECT COUNT(*) INTO v_baru FROM kerusakan_mitra;       banding('kerusakan_mitra', v_lama, v_baru);

  SELECT COUNT(*) INTO v_lama FROM &SCHEMA_LAMA..DATA_CART_DETAIL_RELIABIITY;
  SELECT COUNT(*) INTO v_baru FROM penilaian_kondisi;     banding('penilaian_kondisi', v_lama, v_baru);

  DBMS_OUTPUT.PUT_LINE(CHR(10) || 'Kolom berulang yang menjadi baris:');

  SELECT COUNT(*) INTO v_baru FROM kerusakan_persetujuan;
  DBMS_OUTPUT.PUT_LINE('  kerusakan_persetujuan       : ' || v_baru ||
                       '   (dari 4 kelompok kolom)');

  SELECT COUNT(*) INTO v_baru FROM lampiran WHERE entitas = 'KERUSAKAN';
  DBMS_OUTPUT.PUT_LINE('  lampiran kerusakan          : ' || v_baru ||
                       '   (dari 7 kolom dokumen + tabel foto)');

  SELECT COUNT(*) INTO v_baru FROM penilaian_kondisi WHERE kerusakan_ref IS NOT NULL;
  DBMS_OUTPUT.PUT_LINE('  penilaian tahap KERUSAKAN   : ' || v_baru);

  DBMS_OUTPUT.PUT_LINE(CHR(10) || 'Pengecualian yang perlu ditindaklanjuti:');

  SELECT COUNT(*) INTO v_baru FROM kerusakan WHERE alat_id IS NULL;
  DBMS_OUTPUT.PUT_LINE('  kerusakan tanpa alat        : ' || v_baru);

  -- Seluruhnya: ID_CART_HEADER kosong pada 32 dari 32 baris di sumbernya.
  -- Laporan kerusakan di sistem lama tidak pernah dikaitkan ke peminjaman.
  SELECT COUNT(*) INTO v_baru FROM kerusakan WHERE peminjaman_id IS NULL;
  DBMS_OUTPUT.PUT_LINE('  kerusakan tanpa peminjaman  : ' || v_baru ||
                       '   (kosong di sumber, bukan gagal petakan)');

  SELECT COUNT(*) INTO v_baru FROM pemakaian_wo_aktivitas WHERE wo_id IS NULL;
  DBMS_OUTPUT.PUT_LINE('  aktivitas tanpa work order  : ' || v_baru ||
                       '   (hanya menunjuk pengajuan)');

  SELECT COUNT(*) INTO v_baru FROM operator_alat WHERE pengguna_id IS NULL;
  DBMS_OUTPUT.PUT_LINE('  operator tanpa akun cocok   : ' || v_baru);

  SELECT COUNT(*) INTO v_baru FROM penilaian_kondisi WHERE peminjaman_alat_id IS NULL;
  DBMS_OUTPUT.PUT_LINE('  penilaian hanya ke kerusakan: ' || v_baru);
END;
/

EXIT
