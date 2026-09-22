"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const konfigurasi_1 = require("./konfigurasi/konfigurasi");
async function jalankan() {
    const konf = (0, konfigurasi_1.bacaKonfigurasi)();
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { logger: ['log', 'warn', 'error'] });
    app.setGlobalPrefix('api');
    // Validasi isi permintaan memakai zod di masing-masing controller, bukan
    // ValidationPipe berbasis dekorator: satu cara validasi saja, dan skemanya
    // dapat diuji sebagai fungsi biasa.
    app.enableShutdownHooks();
    await app.listen(konf.PORT);
    const log = new common_1.Logger('mulai');
    log.log(`API siap di http://localhost:${konf.PORT}/api`);
    log.log(`Basis data: ${konf.DB_USER}@${konf.DB_HOST}:${konf.DB_PORT}/${konf.DB_SERVICE}`);
    if (konf.AUTH_LEWATI_DIREKTORI) {
        log.warn('AUTH_LEWATI_DIREKTORI aktif — siapa pun yang tahu satu username sah ' +
            'dapat masuk tanpa sandi. Hanya untuk pengembangan lokal.');
    }
}
jalankan().catch((galat) => {
    // eslint-disable-next-line no-console
    console.error('Gagal menyalakan API:', galat instanceof Error ? galat.message : galat);
    process.exit(1);
});
//# sourceMappingURL=main.js.map