-- Migrasi Domain B — Data alat (PRD 7)
-- Dijalankan setelah 01_domain_a_pengguna.sql (butuh unit, bidang, referensi,
-- dan pengguna).

SET SQLBLANKLINES ON
SET SERVEROUTPUT ON
DEFINE SCHEMA_LAMA = IPTOOLS

--------------------------------------------------------------------------------
-- 0. Kosongkan
--------------------------------------------------------------------------------
DELETE FROM alat_usulan_riwayat;
DELETE FROM alat_usulan_perubahan;
DELETE FROM alat_sertifikat;
DELETE FROM alat_aksesoris;
DELETE FROM lampiran WHERE entitas IN ('ALAT','ALAT_SERTIFIKAT');
DELETE FROM alat;
COMMIT;

--------------------------------------------------------------------------------
-- 0b. Melengkapi daftar pilihan dari nilai yang benar-benar dipakai
--------------------------------------------------------------------------------
-- DAFTAR_TOOL menyimpan JNS, KONDISI, dan LOKASI sebagai teks, bukan sebagai
-- rujukan ke tabel daftar pilihannya. Akibatnya banyak nilai dipakai tanpa
-- pernah terdaftar: lokasi seperti 'UPJP PRIOK' muncul ratusan kali sementara
-- MASTER_SEL_LOKASITOOL hanya memuat 20 entri.
--
-- Nilai semacam itu tidak boleh hilang (PRD 7.1 butir 1) dan tidak boleh
-- ditebak. Jadi didaftarkan apa adanya, ditandai dari_migrasi, agar admin dapat
-- merapikannya kemudian lewat layar master.
DELETE FROM referensi WHERE dari_migrasi = 1;

INSERT INTO referensi (tipe, kode, nama, urutan, dari_migrasi)
SELECT 'JENIS_ALAT', 'MIGRASI-' || ROWNUM, nilai, 900 + ROWNUM, 1
  FROM (SELECT MIN(TRIM(dt.JNS)) nilai
          FROM &SCHEMA_LAMA..DAFTAR_TOOL dt
         WHERE dt.JNS IS NOT NULL AND TRIM(dt.JNS) IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM referensi r
                            WHERE r.tipe = 'JENIS_ALAT'
                              AND UPPER(TRIM(r.nama)) = UPPER(TRIM(dt.JNS)))
         GROUP BY UPPER(TRIM(dt.JNS)));

INSERT INTO referensi (tipe, kode, nama, urutan, dari_migrasi)
SELECT 'KONDISI_ALAT', 'MIGRASI-' || ROWNUM, nilai, 900 + ROWNUM, 1
  FROM (SELECT MIN(TRIM(dt.KONDISI)) nilai
          FROM &SCHEMA_LAMA..DAFTAR_TOOL dt
         WHERE dt.KONDISI IS NOT NULL AND TRIM(dt.KONDISI) IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM referensi r
                            WHERE r.tipe = 'KONDISI_ALAT'
                              AND UPPER(TRIM(r.nama)) = UPPER(TRIM(dt.KONDISI)))
         GROUP BY UPPER(TRIM(dt.KONDISI)));

INSERT INTO referensi (tipe, kode, nama, urutan, dari_migrasi)
SELECT 'LOKASI_ALAT', 'MIGRASI-' || ROWNUM, nilai, 900 + ROWNUM, 1
  FROM (SELECT MIN(TRIM(dt.LOKASI)) nilai
          FROM &SCHEMA_LAMA..DAFTAR_TOOL dt
         WHERE dt.LOKASI IS NOT NULL AND TRIM(dt.LOKASI) IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM referensi r
                            WHERE r.tipe = 'LOKASI_ALAT'
                              AND UPPER(TRIM(r.nama)) = UPPER(TRIM(dt.LOKASI)))
         GROUP BY UPPER(TRIM(dt.LOKASI)));

-- Nama bidang yang dipakai alat tetapi tidak terdaftar di MASTER_BIDANG_TOOL.
DELETE FROM bidang WHERE dari_migrasi = 1;

INSERT INTO bidang (nama, dari_migrasi)
SELECT MIN(TRIM(dt.BIDANG)), 1
  FROM &SCHEMA_LAMA..DAFTAR_TOOL dt
 WHERE dt.BIDANG IS NOT NULL AND TRIM(dt.BIDANG) IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM bidang b
                    WHERE UPPER(TRIM(b.nama)) = UPPER(TRIM(dt.BIDANG)))
 GROUP BY UPPER(TRIM(dt.BIDANG));

COMMIT;

--------------------------------------------------------------------------------
-- 1. alat — termasuk yang sudah dihapus
--------------------------------------------------------------------------------
-- DAFTAR_TOOL_DELETED adalah tabel kembar berisi alat yang dihapus. Keduanya
-- disatukan di sini: yang terdaftar sebagai terhapus cukup diberi tanda waktu
-- pada dihapus_pada (PRD 6.3).
--
-- Nilai teks JNS/KONDISI/LOKASI dicocokkan ke daftar pilihan terpusat dengan
-- perbandingan yang mengabaikan besar kecil huruf dan spasi berlebih. Yang
-- tidak dikenali dibiarkan kosong dan dilaporkan di bagian 6 — tidak ditebak.
INSERT INTO alat (
  kode_barcode, nama, nama_panggilan, spesifikasi, fungsi,
  jenis_id, kondisi_id, lokasi_id, persen_kondisi,
  unit_id, bidang_id,
  kode_maximo, nomor_aset, tahun_perolehan, nilai_kontrak, masa_manfaat,
  estimasi_pertahun, estimasi_persurat,
  status, status_perbaikan, dihapus_pada, dibuat_pada, id_lama)
SELECT
  dt.KODE_BC,
  NVL(dt.NM_TOOL, '(tanpa nama)'),
  dt.NICK_NAME,
  dt.SPESIFIKASI,
  dt.FUNGSI,
  (SELECT r.id FROM referensi r
    WHERE r.tipe = 'JENIS_ALAT'   AND UPPER(TRIM(r.nama)) = UPPER(TRIM(dt.JNS))),
  (SELECT r.id FROM referensi r
    WHERE r.tipe = 'KONDISI_ALAT' AND UPPER(TRIM(r.nama)) = UPPER(TRIM(dt.KONDISI))),
  (SELECT r.id FROM referensi r
    WHERE r.tipe = 'LOKASI_ALAT'  AND UPPER(TRIM(r.nama)) = UPPER(TRIM(dt.LOKASI))),
  dt.PERSEN_KONDISI,
  (SELECT u.id FROM unit u   WHERE u.id_lama = dt.UNIT),
  -- BIDANG menyimpan namanya ('MECHANICAL TOOL'), bukan id.
  (SELECT b.id FROM bidang b WHERE UPPER(TRIM(b.nama)) = UPPER(TRIM(dt.BIDANG))),
  dt.KODE_MAXIMO,
  dt.ASSETNUM,
  dt.THN_PEROLEHAN,
  dt.HARGA_KONTRAK,
  dt.MASA_MANFAAT_TOR,
  dt.ESTIMASI_PERTAHUN,
  dt.ESTIMASI_PERSURAT,
  dt.STATUS,
  dt.STATUS_PERBAIKAN,
  CASE WHEN EXISTS (SELECT 1 FROM &SCHEMA_LAMA..DAFTAR_TOOL_DELETED d
                     WHERE d.NOURUT = dt.NOURUT)
       THEN CAST(dt.TGLCREATE AS TIMESTAMP WITH TIME ZONE) END,
  CAST(NVL(dt.TGLCREATE, SYSDATE) AS TIMESTAMP WITH TIME ZONE),
  dt.NOURUT
FROM &SCHEMA_LAMA..DAFTAR_TOOL dt;

COMMIT;

--------------------------------------------------------------------------------
-- 2. Gambar dan manual alat menjadi baris lampiran
--------------------------------------------------------------------------------
-- Empat kolom gambar dan satu kolom manual menjadi baris. Nilai penanda kosong
-- yang dipakai sistem lama ('KOSONG', '-') tidak ikut dibawa sebagai berkas.
INSERT INTO lampiran (entitas, entitas_id, jenis, nama_berkas, urutan, id_lama)
SELECT 'ALAT', a.id, 'GAMBAR', g.berkas, g.urutan, 'DAFTAR_TOOL.' || dt.NOURUT
  FROM &SCHEMA_LAMA..DAFTAR_TOOL dt
  JOIN alat a ON a.id_lama = dt.NOURUT
 CROSS JOIN LATERAL (
   SELECT dt.GAMBAR1 berkas, 1 urutan FROM dual UNION ALL
   SELECT dt.GAMBAR2, 2 FROM dual UNION ALL
   SELECT dt.GAMBAR3, 3 FROM dual UNION ALL
   SELECT dt.GAMBAR4, 4 FROM dual
 ) g
 WHERE g.berkas IS NOT NULL
   AND UPPER(TRIM(g.berkas)) NOT IN ('KOSONG','-','NULL');

INSERT INTO lampiran (entitas, entitas_id, jenis, nama_berkas, id_lama)
SELECT 'ALAT', a.id, 'MANUAL', dt.MANUAL, 'DAFTAR_TOOL.MANUAL.' || dt.NOURUT
  FROM &SCHEMA_LAMA..DAFTAR_TOOL dt
  JOIN alat a ON a.id_lama = dt.NOURUT
 WHERE dt.MANUAL IS NOT NULL
   AND UPPER(TRIM(dt.MANUAL)) NOT IN ('KOSONG','-','NULL');

INSERT INTO lampiran (entitas, entitas_id, jenis, nama_berkas, id_lama)
SELECT 'ALAT', a.id, 'MANUAL', mb.ALAMAT_FILE, 'MASTER_MANUALBOOK.' || mb.ID_MANUALBOOK
  FROM &SCHEMA_LAMA..MASTER_MANUALBOOK mb
  JOIN alat a ON a.id_lama = mb.NOURUT
 WHERE mb.ALAMAT_FILE IS NOT NULL;

COMMIT;

--------------------------------------------------------------------------------
-- 3. alat_aksesoris
--------------------------------------------------------------------------------
INSERT INTO alat_aksesoris (alat_id, nama, jumlah, satuan, standar, standar_jalan,
                            dibuat_pada, id_lama)
SELECT a.id,
       NVL(ak.AKSESORIS, '(tanpa nama)'),
       ak.QUANTITY, ak.SATUAN, ak.STANDARD, ak.STANDARD_JALAN,
       CAST(NVL(ak.CREATED_DATE, SYSTIMESTAMP) AS TIMESTAMP WITH TIME ZONE),
       ak.NOURUT_AKSESORIS
  FROM &SCHEMA_LAMA..DAFTAR_TOOL_AKSESORIS ak
  JOIN alat a ON a.id_lama = ak.NOURUT;

--------------------------------------------------------------------------------
-- 4. alat_sertifikat
--------------------------------------------------------------------------------
INSERT INTO alat_sertifikat (alat_id, nomor, tanggal_kalibrasi, tanggal_saran,
                             hasil, pelaksana, dibuat_pada, id_lama)
SELECT a.id, s.NOSERTIFIKAT, s.TGL_KALIBRASI, s.TGL_SARAN, s.HASIL, s.PELAKSANA,
       CAST(NVL(s.CREATED_DATE, SYSTIMESTAMP) AS TIMESTAMP WITH TIME ZONE),
       s.ID_SERTIFIKAT_TOOL
  FROM &SCHEMA_LAMA..DAFTAR_TOOL_SERTIFIKAT s
  JOIN alat a ON a.id_lama = s.NOURUT_TOOL;

INSERT INTO lampiran (entitas, entitas_id, jenis, nama_berkas, id_lama)
SELECT 'ALAT_SERTIFIKAT', ns.id, 'SERTIFIKAT', s.FILE_SERTIFIKAT,
       'DAFTAR_TOOL_SERTIFIKAT.' || s.ID_SERTIFIKAT_TOOL
  FROM &SCHEMA_LAMA..DAFTAR_TOOL_SERTIFIKAT s
  JOIN alat_sertifikat ns ON ns.id_lama = s.ID_SERTIFIKAT_TOOL
 WHERE s.FILE_SERTIFIKAT IS NOT NULL;

COMMIT;

--------------------------------------------------------------------------------
-- 5. alat_usulan_perubahan dan riwayatnya
--------------------------------------------------------------------------------
-- 28 kolom kembar diringkas menjadi satu dokumen JSON. Hanya kolom yang benar
-- benar diisi yang masuk, sehingga usulan lama tetap terbaca tanpa memaksa
-- bentuknya menyerupai tabel alat.
INSERT INTO alat_usulan_perubahan (
  alat_id, tindakan, isi_usulan, keterangan, status,
  diusulkan_oleh, nama_pengusul_historis, dibuat_pada, id_lama)
SELECT
  (SELECT a.id FROM alat a WHERE a.id_lama = t.NOURUT),
  CASE UPPER(NVL(t.ACTION, 'UBAH'))
    WHEN 'INSERT' THEN 'TAMBAH'
    WHEN 'ADD'    THEN 'TAMBAH'
    WHEN 'DELETE' THEN 'HAPUS'
    ELSE 'UBAH'
  END,
  JSON_OBJECT(
    'namaAlat'         VALUE t.NM_TOOL,
    'kodeBarcode'      VALUE t.KODE_BC,
    'namaPanggilan'    VALUE t.NICK_NAME,
    'jenis'            VALUE t.JNS,
    'spesifikasi'      VALUE t.SPESIFIKASI,
    'kondisi'          VALUE t.KONDISI,
    'lokasi'           VALUE t.LOKASI,
    'kodeMaximo'       VALUE t.KODE_MAXIMO,
    'nomorAset'        VALUE t.ASSETNUM,
    'tahunPerolehan'   VALUE t.THN_PEROLEHAN,
    'nilaiKontrak'     VALUE t.HARGA_KONTRAK,
    'masaManfaat'      VALUE t.MASA_MANFAAT_TOR,
    'estimasiPertahun' VALUE t.ESTIMASI_PERTAHUN,
    'estimasiPersurat' VALUE t.ESTIMASI_PERSURAT,
    'fungsi'           VALUE t.FUNGSI
    ABSENT ON NULL RETURNING CLOB),
  NULL,
  NVL(t.STATUS_ACTION, 'TIDAK DIKETAHUI'),
  (SELECT p.id FROM pengguna p WHERE LOWER(p.email) = LOWER(t.EMAIL_USERCREATE)
     AND p.duplikat_dari IS NULL AND ROWNUM = 1),
  t.USERCREATE,
  CAST(NVL(t.TGLCREATE, SYSDATE) AS TIMESTAMP WITH TIME ZONE),
  t.ID_TEMP_UPDATE
FROM &SCHEMA_LAMA..DAFTAR_TOOL_TEMP_ACTION t;

-- Procedure keputusan lama menulis 'APPROVE' ke riwayat tanpa melihat keputusan
-- sebenarnya — nilainya ditulis mati di luar cabang setuju/tolak. Akibatnya 35
-- penolakan tercatat sebagai persetujuan (docs/aturan-bisnis/usulan-alat.md §3.3).
--
-- Baris seperti itu dikoreksi menjadi REJECT dan diberi keterangan, sehingga
-- riwayat menjawab dengan benar siapa menyetujui apa. Penyimpangan disengaja ini
-- dicatat sesuai PRD 8.1 langkah 5.
INSERT INTO alat_usulan_riwayat (usulan_id, status, keterangan, oleh, nama_historis,
                                 dibuat_pada, id_lama)
SELECT u.id,
       CASE WHEN UPPER(h.STATUS_ACTION) = 'APPROVE' AND UPPER(t.STATUS_ACTION) = 'REJECT'
            THEN 'REJECT' ELSE h.STATUS_ACTION END,
       CASE WHEN UPPER(h.STATUS_ACTION) = 'APPROVE' AND UPPER(t.STATUS_ACTION) = 'REJECT'
            THEN SUBSTR('[Dikoreksi saat migrasi: sistem lama mencatat APPROVE untuk usulan '
                     || 'yang ditolak] ' || h.KETERANGAN, 1, 2000)
            ELSE h.KETERANGAN END,
       (SELECT p.id FROM pengguna p WHERE LOWER(p.email) = LOWER(h.EMAIL_USERCREATE)
          AND p.duplikat_dari IS NULL AND ROWNUM = 1),
       h.USERCREATE,
       CAST(NVL(h.TGLCREATE, SYSDATE) AS TIMESTAMP WITH TIME ZONE),
       h.ID_HIST
  FROM &SCHEMA_LAMA..DAFTAR_TOOL_ACTION_HIST h
  LEFT JOIN &SCHEMA_LAMA..DAFTAR_TOOL_TEMP_ACTION t ON t.ID_TEMP_UPDATE = h.ID_TEMP
  LEFT JOIN alat_usulan_perubahan u ON u.id_lama = h.ID_TEMP;

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

  SELECT COUNT(*) INTO v_lama FROM &SCHEMA_LAMA..DAFTAR_TOOL;
  SELECT COUNT(*) INTO v_baru FROM alat;                    banding('alat', v_lama, v_baru);

  SELECT COUNT(*) INTO v_lama FROM &SCHEMA_LAMA..DAFTAR_TOOL_AKSESORIS;
  SELECT COUNT(*) INTO v_baru FROM alat_aksesoris;          banding('alat_aksesoris', v_lama, v_baru);

  SELECT COUNT(*) INTO v_lama FROM &SCHEMA_LAMA..DAFTAR_TOOL_SERTIFIKAT;
  SELECT COUNT(*) INTO v_baru FROM alat_sertifikat;         banding('alat_sertifikat', v_lama, v_baru);

  SELECT COUNT(*) INTO v_lama FROM &SCHEMA_LAMA..DAFTAR_TOOL_TEMP_ACTION;
  SELECT COUNT(*) INTO v_baru FROM alat_usulan_perubahan;   banding('alat_usulan_perubahan', v_lama, v_baru);

  SELECT COUNT(*) INTO v_lama FROM &SCHEMA_LAMA..DAFTAR_TOOL_ACTION_HIST;
  SELECT COUNT(*) INTO v_baru FROM alat_usulan_riwayat;     banding('alat_usulan_riwayat', v_lama, v_baru);

  DBMS_OUTPUT.PUT_LINE(CHR(10) || 'Pengecualian yang perlu ditindaklanjuti:');

  SELECT COUNT(*) INTO v_baru FROM alat WHERE dihapus_pada IS NOT NULL;
  DBMS_OUTPUT.PUT_LINE('  alat ditandai terhapus      : ' || v_baru);

  SELECT COUNT(*) INTO v_baru FROM alat WHERE jenis_id IS NULL;
  DBMS_OUTPUT.PUT_LINE('  jenis tidak dikenali        : ' || v_baru);

  SELECT COUNT(*) INTO v_baru FROM alat WHERE kondisi_id IS NULL;
  DBMS_OUTPUT.PUT_LINE('  kondisi tidak dikenali      : ' || v_baru);

  SELECT COUNT(*) INTO v_baru FROM alat WHERE lokasi_id IS NULL;
  DBMS_OUTPUT.PUT_LINE('  lokasi tidak dikenali       : ' || v_baru);

  SELECT COUNT(*) INTO v_baru FROM alat WHERE unit_id IS NULL;
  DBMS_OUTPUT.PUT_LINE('  tanpa unit                  : ' || v_baru);

  SELECT COUNT(*) INTO v_baru FROM alat WHERE bidang_id IS NULL;
  DBMS_OUTPUT.PUT_LINE('  tanpa bidang                : ' || v_baru);

  SELECT COUNT(*) INTO v_baru FROM alat WHERE kode_barcode IS NULL;
  DBMS_OUTPUT.PUT_LINE('  tanpa kode barcode          : ' || v_baru);

  SELECT COUNT(*) INTO v_baru FROM lampiran WHERE entitas IN ('ALAT','ALAT_SERTIFIKAT');
  DBMS_OUTPUT.PUT_LINE('  lampiran alat dibuat        : ' || v_baru);

  SELECT COUNT(*) INTO v_baru FROM referensi WHERE dari_migrasi = 1;
  DBMS_OUTPUT.PUT_LINE('  pilihan baru dari data lama : ' || v_baru ||
                       '   (perlu dirapikan admin)');

  -- Aksesoris yang menunjuk alat yang tidak ada. Tidak dapat dipindahkan, dan
  -- tidak boleh hilang tanpa disebut.
  SELECT COUNT(*) INTO v_baru
    FROM &SCHEMA_LAMA..DAFTAR_TOOL_AKSESORIS ak
   WHERE NOT EXISTS (SELECT 1 FROM &SCHEMA_LAMA..DAFTAR_TOOL dt
                      WHERE dt.NOURUT = ak.NOURUT);
  DBMS_OUTPUT.PUT_LINE('  aksesoris tanpa alat        : ' || v_baru ||
                       '   <-- inilah selisih alat_aksesoris');
END;
/

EXIT
