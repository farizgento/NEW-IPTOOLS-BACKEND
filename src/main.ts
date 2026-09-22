import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { bacaKonfigurasi } from './konfigurasi/konfigurasi';

async function jalankan(): Promise<void> {
  const konf = bacaKonfigurasi();
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'] });

  app.setGlobalPrefix('api');
  // Validasi isi permintaan memakai zod di masing-masing controller, bukan
  // ValidationPipe berbasis dekorator: satu cara validasi saja, dan skemanya
  // dapat diuji sebagai fungsi biasa.
  app.enableShutdownHooks();

  await app.listen(konf.PORT);

  const log = new Logger('mulai');
  log.log(`API siap di http://localhost:${konf.PORT}/api`);
  log.log(`Basis data: ${konf.DB_USER}@${konf.DB_HOST}:${konf.DB_PORT}/${konf.DB_SERVICE}`);
  if (konf.AUTH_LEWATI_DIREKTORI) {
    log.warn(
      'AUTH_LEWATI_DIREKTORI aktif — siapa pun yang tahu satu username sah ' +
        'dapat masuk tanpa sandi. Hanya untuk pengembangan lokal.',
    );
  }
}

jalankan().catch((galat: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Gagal menyalakan API:', galat instanceof Error ? galat.message : galat);
  process.exit(1);
});
