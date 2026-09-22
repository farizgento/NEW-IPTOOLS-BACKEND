"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.terbitkanToken = terbitkanToken;
exports.verifikasiToken = verifikasiToken;
exports.ambilTokenDariHeader = ambilTokenDariHeader;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function terbitkanToken(isi, rahasia, umurDetik) {
    return jsonwebtoken_1.default.sign(isi, rahasia, { expiresIn: umurDetik, algorithm: 'HS256' });
}
/**
 * Memverifikasi token. Berbeda dari sistem lama yang menerbitkan token lalu
 * tidak pernah memeriksanya sama sekali (PRD 2.5), setiap permintaan melewati
 * fungsi ini.
 */
function verifikasiToken(token, rahasia) {
    try {
        const isi = jsonwebtoken_1.default.verify(token, rahasia, { algorithms: ['HS256'] });
        if (typeof isi.sub !== 'number' && typeof isi.sub !== 'string') {
            return { sah: false, alasan: 'token tanpa pemilik' };
        }
        return {
            sah: true,
            isi: {
                sub: Number(isi.sub),
                peran: Array.isArray(isi.peran) ? isi.peran : [],
                unitId: typeof isi.unitId === 'number' ? isi.unitId : null,
            },
        };
    }
    catch (galat) {
        const pesan = galat instanceof Error ? galat.message : 'token tidak sah';
        return { sah: false, alasan: pesan };
    }
}
/** Mengambil token dari header Authorization. */
function ambilTokenDariHeader(header) {
    if (!header)
        return undefined;
    const [jenis, nilai] = header.split(' ');
    if (!jenis || !nilai)
        return undefined;
    if (jenis.toLowerCase() !== 'bearer')
        return undefined;
    return nilai.trim() || undefined;
}
//# sourceMappingURL=token.js.map