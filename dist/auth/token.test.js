"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const token_1 = require("./token");
const RAHASIA = 'rahasia-uji-yang-cukup-panjang-untuk-hs256';
(0, vitest_1.describe)('token', () => {
    (0, vitest_1.it)('menerbitkan lalu memverifikasi token yang sama', () => {
        const token = (0, token_1.terbitkanToken)({ sub: 42, peran: ['PENGELOLA'], unitId: 7 }, RAHASIA, 60);
        const hasil = (0, token_1.verifikasiToken)(token, RAHASIA);
        (0, vitest_1.expect)(hasil.sah).toBe(true);
        (0, vitest_1.expect)(hasil.isi).toMatchObject({ sub: 42, peran: ['PENGELOLA'], unitId: 7 });
    });
    (0, vitest_1.it)('menolak token yang ditandatangani kunci lain', () => {
        const token = (0, token_1.terbitkanToken)({ sub: 1, peran: [], unitId: null }, 'kunci-lain-yang-panjang-sekali', 60);
        (0, vitest_1.expect)((0, token_1.verifikasiToken)(token, RAHASIA).sah).toBe(false);
    });
    (0, vitest_1.it)('menolak token kedaluwarsa', () => {
        const token = (0, token_1.terbitkanToken)({ sub: 1, peran: [], unitId: null }, RAHASIA, -1);
        const hasil = (0, token_1.verifikasiToken)(token, RAHASIA);
        (0, vitest_1.expect)(hasil.sah).toBe(false);
        (0, vitest_1.expect)(hasil.alasan).toContain('expired');
    });
    (0, vitest_1.it)('menolak teks sembarang', () => {
        (0, vitest_1.expect)((0, token_1.verifikasiToken)('bukan-token', RAHASIA).sah).toBe(false);
    });
});
(0, vitest_1.describe)('ambilTokenDariHeader', () => {
    (0, vitest_1.it)('mengambil nilai setelah Bearer', () => {
        (0, vitest_1.expect)((0, token_1.ambilTokenDariHeader)('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    });
    (0, vitest_1.it)('tidak peduli besar kecil huruf pada kata Bearer', () => {
        (0, vitest_1.expect)((0, token_1.ambilTokenDariHeader)('bearer abc')).toBe('abc');
    });
    (0, vitest_1.it)('mengabaikan skema selain Bearer', () => {
        (0, vitest_1.expect)((0, token_1.ambilTokenDariHeader)('Basic abc')).toBeUndefined();
    });
    (0, vitest_1.it)('mengabaikan header kosong atau tidak lengkap', () => {
        (0, vitest_1.expect)((0, token_1.ambilTokenDariHeader)(undefined)).toBeUndefined();
        (0, vitest_1.expect)((0, token_1.ambilTokenDariHeader)('Bearer')).toBeUndefined();
    });
});
//# sourceMappingURL=token.test.js.map