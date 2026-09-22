import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { KeranjangRepository } from './keranjang.repository';
import type { PermintaanBerpengguna } from '../auth/auth.guard';

const skemaTambah = z.object({ alatId: z.coerce.number().int().positive() });

@Controller('keranjang')
export class KeranjangController {
  constructor(private readonly repo: KeranjangRepository) {}

  @Get()
  async isi(@Req() permintaan: PermintaanBerpengguna) {
    const isi = await this.repo.isi(permintaan.pengguna!.id);
    return { jumlah: isi.length, isi };
  }

  @Post()
  async tambah(@Req() permintaan: PermintaanBerpengguna, @Body() badan: unknown) {
    const { alatId } = skemaTambah.parse(badan);
    await this.repo.tambah(permintaan.pengguna!.id, alatId);
    return this.isi(permintaan);
  }

  @Delete(':alatId')
  async hapus(
    @Req() permintaan: PermintaanBerpengguna,
    @Param('alatId', ParseIntPipe) alatId: number,
  ) {
    await this.repo.hapus(permintaan.pengguna!.id, alatId);
    return this.isi(permintaan);
  }

  @Delete()
  async kosongkan(@Req() permintaan: PermintaanBerpengguna) {
    await this.repo.kosongkan(permintaan.pengguna!.id);
    return { jumlah: 0, isi: [] };
  }
}
