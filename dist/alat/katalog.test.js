"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const alat_repository_1 = require("./alat.repository");
function siapkan() {
    const db = {
        kueriSatu: vitest_1.vi.fn().mockResolvedValue({ TOTAL: 1 }),
        kueri: vitest_1.vi.fn().mockResolvedValue([
            { ID: 1, NAMA: 'Megger #A', MODEL: 'megger', SEDANG_DIPAKAI: null },
            { ID: 2, NAMA: 'Megger #B', MODEL: 'megger', SEDANG_DIPAKAI: 2 },
        ]),
    };
    return { db, repo: new alat_repository_1.AlatRepository(db) };
}
(0, vitest_1.describe)('katalog model alat', () => {
    (0, vitest_1.it)('memaginasi model, bukan memotong unit fisik dalam satu model', async () => {
        const { db, repo } = siapkan();
        const hasil = await repo.katalog({ kelompok: true, halaman: 2, perHalaman: 20 });
        const [sql, ikatan] = db.kueri.mock.calls[0];
        (0, vitest_1.expect)(sql).toContain('DENSE_RANK() OVER');
        (0, vitest_1.expect)(sql).toContain('urutan_model > :mulai');
        (0, vitest_1.expect)(ikatan).toMatchObject({ mulai: 20, ambil: 20 });
        (0, vitest_1.expect)(hasil.total).toBe(1);
        (0, vitest_1.expect)(hasil.isi.map(a => a.model)).toEqual(['megger', 'megger']);
        (0, vitest_1.expect)(hasil.isi.map(a => a.tersedia)).toEqual([true, false]);
    });
    (0, vitest_1.it)('saringan tersedia mempertahankan unit yang dipakai untuk penyebut stok', async () => {
        const { db, repo } = siapkan();
        await repo.katalog({ kelompok: true, hanyaTersedia: true, urut: 'tersedia', halaman: 1, perHalaman: 20 });
        const sql = db.kueri.mock.calls[0][0];
        (0, vitest_1.expect)(sql).toContain('ORDER BY stok_model DESC, model');
        (0, vitest_1.expect)(sql).toContain('WHERE stok_model > 0');
        (0, vitest_1.expect)(sql).not.toContain('AND pakai.alat_id IS NULL');
        (0, vitest_1.expect)(db.kueriSatu.mock.calls[0][0]).toContain('HAVING MAX(CASE WHEN pakai.alat_id IS NULL THEN 1 ELSE 0 END) = 1');
    });
    (0, vitest_1.it)('katalog unit lama tetap memakai paging dan bind parameter', async () => {
        const { db, repo } = siapkan();
        await repo.katalog({ cari: "x' OR 1=1", hanyaTersedia: true, halaman: 1, perHalaman: 10 });
        const [sql, ikatan] = db.kueri.mock.calls[0];
        (0, vitest_1.expect)(sql).toContain('OFFSET :mulai ROWS FETCH NEXT :ambil ROWS ONLY');
        (0, vitest_1.expect)(sql).toContain('AND pakai.alat_id IS NULL');
        (0, vitest_1.expect)(sql).not.toContain("x' OR 1=1");
        (0, vitest_1.expect)(ikatan).toMatchObject({ cari: "%X' OR 1=1%", mulai: 0, ambil: 10 });
    });
});
//# sourceMappingURL=katalog.test.js.map