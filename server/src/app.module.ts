import { Module } from '@nestjs/common'
import { AppController } from '@/app.controller'
import { AppService } from '@/app.service'
import { BaziController } from '@/bazi/bazi.controller'
import { BaziService } from '@/bazi/bazi.service'
import { ConfigModule } from '@/config/config.module'
import { ConfigService } from '@/config/config.service'

@Module({
  imports: [ConfigModule],
  controllers: [AppController, BaziController],
  providers: [AppService, BaziService, ConfigService],
})
export class AppModule {}
