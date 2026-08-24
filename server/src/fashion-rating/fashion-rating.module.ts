import { Module } from '@nestjs/common'
import { FashionRatingController } from './fashion-rating.controller'
import { FashionRatingService } from './fashion-rating.service'

@Module({
  controllers: [FashionRatingController],
  providers: [FashionRatingService],
})
export class FashionRatingModule {}
