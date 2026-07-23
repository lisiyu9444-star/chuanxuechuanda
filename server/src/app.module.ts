import { Module } from '@nestjs/common'
import { AppController } from '@/app.controller'
import { AppService } from '@/app.service'
import { BaziController } from '@/bazi/bazi.controller'
import { BaziService } from '@/bazi/bazi.service'

@Module({
  imports: [],
  controllers: [AppController, BaziController],
  providers: [AppService, BaziService],
})
export class AppModule {}
