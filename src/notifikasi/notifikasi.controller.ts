import { Controller, Get, Post } from '@nestjs/common';
import { NotifikasiService } from './notifikasi.service';
import { ButuhPeran } from '../auth/auth.guard';

@Controller('notifikasi')
export class NotifikasiController {
  constructor(private readonly service: NotifikasiService) {}

  @Get('ringkasan')
  @ButuhPeran('ADMIN_UNIT', 'ADMIN_SUPER')
  ringkasan() {
    return this.service.ringkasan();
  }

  /**
   * Menjalankan satu putaran pengingat secara manual.
   *
   * Penjadwal berjalan sendiri, tetapi jalur manual ini membuat aturannya dapat
   * diperiksa kapan saja tanpa menunggu, dan berguna saat memverifikasi
   * perilakunya terhadap data sungguhan.
   */
  @Post('jalankan')
  @ButuhPeran('ADMIN_SUPER')
  jalankan() {
    return this.service.putaran();
  }
}
