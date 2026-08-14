import { Module } from '@nestjs/common'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core'
import { AppController } from '@/app.controller'
import { AppService } from '@/app.service'
import { BaziController } from '@/bazi/bazi.controller'
import { BaziService } from '@/bazi/bazi.service'
import { StylistService } from '@/bazi/stylist.service'
import { ConfigController } from '@/config/config.controller'
import { ShareController } from '@/share/share.controller'

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 分钟
        limit: 10,  // 每分钟最多 10 次请求
      },
    ]),
  ],
  controllers: [AppController, BaziController, ConfigController, ShareController],
  providers: [
    AppService,
    BaziService,
    StylistService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
