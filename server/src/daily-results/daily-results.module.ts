import { Module } from '@nestjs/common'
import { DailyResultsController } from './daily-results.controller'

@Module({
  controllers: [DailyResultsController],
})
export class DailyResultsModule {}
