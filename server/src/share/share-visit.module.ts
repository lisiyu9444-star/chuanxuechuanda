import { Module } from '@nestjs/common'
import { AuthModule } from '@/auth/auth.module'
import { ShareVisitService } from './share-visit.service'

/** 分享访问统计模块：ShareController（AppModule）与 FashionRatingModule 共同复用 */
@Module({
  imports: [AuthModule],
  providers: [ShareVisitService],
  exports: [ShareVisitService],
})
export class ShareVisitModule {}
