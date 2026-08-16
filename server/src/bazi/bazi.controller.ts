import {
  Controller,
  Post,
  Body,
  HttpCode,
  Req,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { BaziService, FourPillar, FavorableAnalysis, OutfitRecommendation, getCurrentGanZhiDate } from './bazi.service'
import { StylistService, StylistResult } from './stylist.service'
import { HeaderUtils } from 'coze-coding-dev-sdk'
import { v4 as uuidv4 } from 'uuid'

@Controller('bazi')
export class BaziController {
  constructor(
    private readonly baziService: BaziService,
    private readonly stylistService: StylistService,
  ) {}

  @Post('calculate')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 每 IP 每分钟最多 5 次
  async calculate(
    @Body()
    body: {
      nickname: string
      gender: string
      birthDate: string
      birthTime: string
      location: string
      calendarType?: 'solar' | 'lunar'
      clientTaskId?: string
      age?: number
      stylePreference?: string
    },
    @Req() req,
  ): Promise<{
    data: {
      taskId: string
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
      age?: number
      ganZhiDate?: {
        month: string
        day: string
      }
      dailyYongShen?: string
      dailyXiShen?: string
      llmPlan?: StylistResult
    }
  }> {
    const { nickname, gender, birthDate, birthTime, calendarType, clientTaskId, age, stylePreference } = body

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

    // 使用客户端传递的 taskId，如果没有则生成新的
    const taskId = clientTaskId || uuidv4()

    // 通过 LLM 穿搭顾问生成结构化方案与生图 prompt
    let llmPlan: StylistResult | undefined
    let imagePrompt = baziResult.outfit.prompt
    const forwardHeaders = HeaderUtils.extractForwardHeaders(
      req.headers as Record<string, string>,
    )
    try {
      llmPlan = await this.stylistService.generatePlan({
        gender: gender === 'female' ? '女' : '男',
        age,
        season: baziResult.outfit.season,
        stylePreference: stylePreference || '简约通勤风',
        yongShen: baziResult.dailyYongShen || baziResult.favorableElement,
        xiShen: baziResult.dailyXiShen || baziResult.favorableAnalysis.assistantXiShen,
      }, forwardHeaders)
      imagePrompt = llmPlan.imagePrompt
      console.log('[Stylist] LLM 方案生成成功，使用 LLM imagePrompt 生图')
      console.log('[Stylist] imagePrompt:', imagePrompt)
    } catch (error) {
      console.error('[Stylist] LLM 方案生成失败，使用默认 prompt:', error)
    }

    // 生成穿搭图片
    const imageUrl = await this.baziService.generateOutfitImage(
      imagePrompt,
      forwardHeaders,
      taskId,
    )

    // 获取当前干支历日期
    const ganZhiDate = getCurrentGanZhiDate()

    return {
      data: {
        taskId,
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
        age,
        ganZhiDate,
        dailyYongShen: baziResult.dailyYongShen,
        dailyXiShen: baziResult.dailyXiShen,
        llmPlan,
      },
    }
  }

  // 取消任务接口
  @Post('cancel')
  @HttpCode(200)
  async cancelTask(
    @Body() body: { taskId: string },
  ): Promise<{ data: { success: boolean } }> {
    console.log('[Cancel] Received cancel request for taskId:', body.taskId)
    const success = this.baziService.cancelTask(body.taskId)
    console.log('[Cancel] Cancel result:', success)
    return { data: { success } }
  }

  // LLM 穿搭顾问测试接口
  @Post('stylist')
  @HttpCode(200)
  async stylist(
    @Body()
    body: {
      gender: string
      age: number
      season: string
      stylePreference: string
      yongShen: string
      xiShen: string
      dayMaster?: string
    },
  ): Promise<{ data: StylistResult }> {
    console.log('[Stylist] Request:', body)
    const result = await this.stylistService.generatePlan(body)
    console.log('[Stylist] Result:', result)
    return { data: result }
  }

  @Post('try-on')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 每 IP 每分钟最多 10 次
  async generateTryOn(
    @Body()
    body: {
      imageUrl: string
      outfit: OutfitRecommendation
      gender: string
      age?: number
    },
    @Req() req,
  ): Promise<{
    data: {
      tryOnUrl: string
    }
  }> {
    const { imageUrl, outfit, gender, age } = body

    const forwardHeaders = HeaderUtils.extractForwardHeaders(
      req.headers as Record<string, string>,
    )

    const tryOnUrl = await this.baziService.generateTryOnImage(
      imageUrl,
      outfit,
      outfit.backgroundColor || '#F5F1E8',
      gender,
      age ?? 25,
      forwardHeaders,
    )

    return {
      data: {
        tryOnUrl,
      },
    }
  }
}
