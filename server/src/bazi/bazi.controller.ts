import {
  Controller,
  Post,
  Body,
  HttpCode,
  Req,
} from '@nestjs/common'
import { BaziService, FourPillar, FavorableAnalysis, OutfitRecommendation } from './bazi.service'
import { HeaderUtils } from 'coze-coding-dev-sdk'

@Controller('bazi')
export class BaziController {
  constructor(private readonly baziService: BaziService) {}

  @Post('calculate')
  @HttpCode(200)
  async calculate(
    @Body()
    body: {
      nickname: string
      gender: string
      birthDate: string
      birthTime: string
      location: string
    },
    @Req() req,
  ): Promise<{
    data: {
      nickname: string
      gender: string
      dayMaster: string
      dayMasterElement: string
      fourPillars: FourPillar[]
      fiveElements: Array<{ name: string; count: number }>
      favorableElement: string
      favorableAnalysis: FavorableAnalysis
      outfit: OutfitRecommendation
      imageUrl: string
    }
  }> {
    const { nickname, gender, birthDate, birthTime } = body

    // 使用 @openfate/bazi-engine 进行专业排盘
    const baziResult = this.baziService.calculateBaZi(birthDate, birthTime, gender)

    // 生成穿搭图片
    const forwardHeaders = HeaderUtils.extractForwardHeaders(
      req.headers as Record<string, string>,
    )
    const imageUrl = await this.baziService.generateOutfitImage(
      baziResult.outfit.prompt,
      forwardHeaders,
    )

    return {
      data: {
        nickname,
        gender,
        dayMaster: baziResult.dayMaster,
        dayMasterElement: baziResult.dayMasterElement,
        fourPillars: baziResult.fourPillars,
        fiveElements: baziResult.fiveElements,
        favorableElement: baziResult.favorableElement,
        favorableAnalysis: baziResult.favorableAnalysis,
        outfit: baziResult.outfit,
        imageUrl,
      },
    }
  }
}
