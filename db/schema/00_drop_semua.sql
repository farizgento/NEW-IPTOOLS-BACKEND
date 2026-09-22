-- Menghapus seluruh objek schema baru. Untuk pengembangan lokal saja.
-- JANGAN dijalankan di lingkungan yang sudah berisi data sungguhan.
SET SQLBLANKLINES ON
SET DEFINE OFF
BEGIN
  FOR t IN (SELECT table_name FROM user_tables) LOOP
    EXECUTE IMMEDIATE 'DROP TABLE "' || t.table_name || '" CASCADE CONSTRAINTS PURGE';
  END LOOP;
END;
/
EXIT
