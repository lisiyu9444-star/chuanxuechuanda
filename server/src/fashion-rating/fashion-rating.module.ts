import { Module } from '@nestjs/common'
import { FashionRatingController } from './fashion-rating.controller'
import { FashionRatingService } from './fashion-rating.service'
import { ShareVisitModule } from '@/share/share-visit.module'

@Module({
  imports: [ShareVisitModule],
  controllers: [FashionRatingController],
  providers: [FashionRatingService],
})
export class FashionRatingModule {}
