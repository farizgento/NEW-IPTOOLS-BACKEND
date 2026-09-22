-- Membuat schema kerja IPTOOLS_NEW beserta hak bacanya atas schema lama.
-- Dijalankan sekali, sebagai SYSDBA, di dalam PDB (bukan CDB$ROOT).
--
--   sqlplus -S -L "/ as sysdba" @db/00_buat_schema.sql
--
-- Catatan lokasi schema lama:
--   produksi  : NEWIPTOOL
--   lokal ini : IPTOOLS   (hasil impor dump produksi)
-- Nama schema lama dipakai lewat variabel SCHEMA_LAMA di bawah agar skrip yang
-- sama berlaku di kedua tempat.

ALTER SESSION SET CONTAINER = XEPDB1;

DEFINE SCHEMA_LAMA = IPTOOLS

-- Pengguna aplikasi. Password lokal saja; di lingkungan nyata diganti dan
-- disimpan di luar repositori.
CREATE USER IPTOOLS_NEW IDENTIFIED BY "070809"
  DEFAULT TABLESPACE USERS
  QUOTA UNLIMITED ON USERS;

GRANT CREATE SESSION            TO IPTOOLS_NEW;
GRANT CREATE TABLE              TO IPTOOLS_NEW;
GRANT CREATE VIEW               TO IPTOOLS_NEW;
GRANT CREATE SEQUENCE           TO IPTOOLS_NEW;

-- Tidak diberikan: CREATE PROCEDURE, CREATE TRIGGER.
-- Skema baru tidak memuat stored procedure maupun trigger bisnis (PRD 8.3.3).

-- Hak baca atas schema lama, hanya untuk keperluan migrasi (PRD 5.0).
-- Dicabut setelah peralihan selesai.
BEGIN
  FOR t IN (SELECT table_name FROM all_tables WHERE owner = '&SCHEMA_LAMA') LOOP
    EXECUTE IMMEDIATE 'GRANT SELECT ON &SCHEMA_LAMA..' || t.table_name || ' TO IPTOOLS_NEW';
  END LOOP;
END;
/

-- Tidak ada satu pun hak tulis ke schema lama. Jangan menambahkannya.

EXIT
