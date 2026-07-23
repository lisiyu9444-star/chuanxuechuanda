import {
  Controller,
  Post,
  Body,
  HttpCode,
  Req,
} from '@nestjs/common'
import { BaziService, FourPillar, OutfitRecommendation } from './bazi.service'
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
      fourPillars: FourPillar[]
      fiveElements: Array<{ name: string; count: number }>
      favorableElement: string
      outfit: OutfitRecommendation
      imageUrl: string
    }
  }> {
    const { nickname, gender, birthDate, birthTime } = body

    // Parse 时辰 index from string like "子时 (23:00-01:00)"
    const shichenMap: Record<string, number> = {
      '子': 0, '丑': 1, '寅': 2, '卯': 3,
      '辰': 4, '巳': 5, '午': 6, '未': 7,
      '申': 8, '酉': 9, '戌': 10, '亥': 11,
    }

    let birthTimeIndex = 0
    for (const [key, idx] of Object.entries(shichenMap)) {
      if (birthTime.startsWith(key)) {
        birthTimeIndex = idx
        break
      }
    }

    // Calculate BaZi
    const baziResult = this.baziService.calculateBaZi(birthDate, birthTimeIndex)

    // Generate outfit image
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
        fourPillars: baziResult.fourPillars,
        fiveElements: baziResult.fiveElements,
        favorableElement: baziResult.favorableElement,
        outfit: baziResult.outfit,
        imageUrl,
      },
    }
  }
}
