-- Menghapus objek Domain B saja, untuk mengulang pembuatannya saat pengembangan.
SET SQLBLANKLINES ON
SET DEFINE OFF
BEGIN
  FOR t IN (SELECT table_name FROM user_tables
             WHERE table_name IN ('ALAT_USULAN_RIWAYAT','ALAT_USULAN_PERUBAHAN',
                                  'ALAT_SERTIFIKAT','ALAT_AKSESORIS','ALAT','LAMPIRAN')) LOOP
    EXECUTE IMMEDIATE 'DROP TABLE "' || t.table_name || '" CASCADE CONSTRAINTS PURGE';
  END LOOP;
END;
/
EXIT
