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
      calendarType?: 'solar' | 'lunar'
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
    const { nickname, gender, birthDate, birthTime, calendarType } = body

    // 如果是农历，先转换为阳历
    let solarBirthDate = birthDate
    if (calendarType === 'lunar') {
      try {
        const { Lunar } = require('lunar-javascript')
        const parts = birthDate.split('-')
        const lunar = Lunar.fromYmd(
          parseInt(parts[0]),
          parseInt(parts[1]),
          parseInt(parts[2]),
        )
        const solar = lunar.getSolar()
        solarBirthDate = `${solar.getYear()}-${String(solar.getMonth()).padStart(2, '0')}-${String(solar.getDay()).padStart(2, '0')}`
        console.log(`农历转换：${birthDate} -> ${solarBirthDate}`)
      } catch (error) {
        console.error('农历转换失败:', error)
        // 转换失败时使用原始日期
      }
    }

    // 使用 @openfate/bazi-engine 进行专业排盘
    const baziResult = this.baziService.calculateBaZi(solarBirthDate, birthTime, gender)

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

  @Post('try-on')
  @HttpCode(200)
  async generateTryOn(
    @Body()
    body: {
      imageUrl: string
      outfit: OutfitRecommendation
      gender: string
    },
    @Req() req,
  ): Promise<{
    data: {
      tryOnUrl: string
    }
  }> {
    const { imageUrl, outfit, gender } = body

    const forwardHeaders = HeaderUtils.extractForwardHeaders(
      req.headers as Record<string, string>,
    )

    const tryOnUrl = await this.baziService.generateTryOnImage(
      imageUrl,
      outfit,
      outfit.backgroundColor || '#F5F1E8',
      gender,
      forwardHeaders,
    )

    return {
      data: {
        tryOnUrl,
      },
    }
  }
}
