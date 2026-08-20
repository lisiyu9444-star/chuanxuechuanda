import {
  Controller,
  Post,
  Body,
  HttpCode,
  Req,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { BaziService, BaZiResult, FourPillar, FavorableAnalysis, OutfitRecommendation, getCurrentGanZhiDate, getTodayStr } from './bazi.service'
import { StylistService, StylistResult, LuckyScore } from './stylist.service'
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
      imageKey?: string
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
    const { nickname, gender, birthDate, birthTime, location, calendarType, clientTaskId, age, stylePreference } = body

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

    // 使用 @openfate/bazi-engine 进行专业排盘（location 用于真太阳时校正）
    const baziResult = this.baziService.calculateBaZi(solarBirthDate, birthTime, gender, location)

    // 使用客户端传递的 taskId，如果没有则生成新的
    const taskId = clientTaskId || uuidv4()
    // 注册任务，使用户退出时可通过 /bazi/cancel 真实中断 LLM 与生图请求
    const signal = this.baziService.registerTask(taskId)

    try {
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
        }, forwardHeaders, signal)
        imagePrompt = llmPlan.imagePrompt
        console.log('[Stylist] LLM 方案生成成功，使用 LLM imagePrompt 生图')
        console.log('[Stylist] imagePrompt:', imagePrompt)
      } catch (error) {
        console.error('[Stylist] LLM 方案生成失败，使用默认 prompt:', error)
      }

      // 生成穿搭图片
      const generated = await this.baziService.generateOutfitImage(
        imagePrompt,
        forwardHeaders,
        taskId,
        signal,
      )
      const imageUrl = generated.url

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
          imageKey: generated.key,
          age,
          ganZhiDate,
          dailyYongShen: baziResult.dailyYongShen,
          dailyXiShen: baziResult.dailyXiShen,
          llmPlan,
        },
      }
    } finally {
      this.baziService.unregisterTask(taskId)
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

  @Post('daily')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async daily(
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
      baziResult: BaZiResult
      llmPlan: StylistResult
      luckyScore: LuckyScore
      date: string
    }
  }> {
    const { nickname, gender, birthDate, birthTime, location, calendarType, clientTaskId, age, stylePreference } = body

    let solarBirthDate = birthDate
    if (calendarType === 'lunar') {
      try {
        const { Lunar } = require('lunar-javascript')
        const parts = birthDate.split('-')
        const lunar = Lunar.fromYmd(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]))
        const solar = lunar.getSolar()
        solarBirthDate = `${solar.getYear()}-${String(solar.getMonth()).padStart(2, '0')}-${String(solar.getDay()).padStart(2, '0')}`
      } catch (error) {
        console.error('农历转换失败:', error)
      }
    }

    // location 用于真太阳时校正
    const baziResult = this.baziService.calculateBaZi(solarBirthDate, birthTime, gender, location)
    const forwardHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>)

    // 注册任务，用户退出后可通过 /bazi/cancel 中断进行中的 LLM 请求
    const taskId = clientTaskId || uuidv4()
    const signal = this.baziService.registerTask(taskId)

    try {
      const [llmPlan, luckyScore] = await Promise.all([
        this.stylistService.generatePlan({
          gender: gender === 'female' ? '女' : '男',
          age,
          season: baziResult.outfit.season,
          stylePreference: stylePreference || '简约通勤风',
          yongShen: baziResult.dailyYongShen || baziResult.favorableElement,
          xiShen: baziResult.dailyXiShen || baziResult.favorableAnalysis.assistantXiShen,
          dayMaster: baziResult.dayMaster,
          mode: 'daily',
        }, forwardHeaders, signal),
        this.stylistService.generateLuckyScore({
          gender: gender === 'female' ? '女' : '男',
          age,
          dayMaster: baziResult.dayMaster,
          yongShen: baziResult.dailyYongShen || baziResult.favorableElement,
          xiShen: baziResult.dailyXiShen || baziResult.favorableAnalysis.assistantXiShen,
        }, forwardHeaders, signal),
      ])

      const ganZhiDate = getCurrentGanZhiDate()

      return {
        data: {
          baziResult: {
            nickname,
            gender,
            dayMaster: baziResult.dayMaster,
            dayMasterElement: baziResult.dayMasterElement,
            fourPillars: baziResult.fourPillars,
            fiveElements: baziResult.fiveElements,
            favorableElement: baziResult.favorableElement,
            favorableAnalysis: baziResult.favorableAnalysis,
            outfit: baziResult.outfit,
            imageUrl: '',
            age,
            ganZhiDate,
            dailyYongShen: baziResult.dailyYongShen || baziResult.favorableElement,
            dailyXiShen: baziResult.dailyXiShen || baziResult.favorableAnalysis.assistantXiShen,
          } as BaZiResult,
          llmPlan,
          luckyScore,
          date: getTodayStr(),
        },
      }
    } finally {
      this.baziService.unregisterTask(taskId)
    }
  }

  @Post('native')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async native(
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
      baziResult: BaZiResult
      llmPlan: StylistResult
    }
  }> {
    const { nickname, gender, birthDate, birthTime, location, calendarType, clientTaskId, age, stylePreference } = body

    let solarBirthDate = birthDate
    if (calendarType === 'lunar') {
      try {
        const { Lunar } = require('lunar-javascript')
        const parts = birthDate.split('-')
        const lunar = Lunar.fromYmd(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]))
        const solar = lunar.getSolar()
        solarBirthDate = `${solar.getYear()}-${String(solar.getMonth()).padStart(2, '0')}-${String(solar.getDay()).padStart(2, '0')}`
      } catch (error) {
        console.error('农历转换失败:', error)
      }
    }

    // location 用于真太阳时校正
    const baziResult = this.baziService.calculateBaZi(solarBirthDate, birthTime, gender, location)
    const forwardHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>)

    // 注册任务，用户退出后可通过 /bazi/cancel 中断进行中的 LLM 请求
    const taskId = clientTaskId || uuidv4()
    const signal = this.baziService.registerTask(taskId)

    try {
      const llmPlan = await this.stylistService.generatePlan({
        gender: gender === 'female' ? '女' : '男',
        age,
        season: baziResult.outfit.season,
        stylePreference: stylePreference || '简约通勤风',
        yongShen: baziResult.favorableElement,
        xiShen: baziResult.favorableAnalysis.assistantXiShen,
        dayMaster: baziResult.dayMaster,
        mode: 'native',
      }, forwardHeaders, signal)

      return {
        data: {
          baziResult: {
            nickname,
            gender,
            dayMaster: baziResult.dayMaster,
            dayMasterElement: baziResult.dayMasterElement,
            fourPillars: baziResult.fourPillars,
            fiveElements: baziResult.fiveElements,
            favorableElement: baziResult.favorableElement,
            favorableAnalysis: baziResult.favorableAnalysis,
            outfit: baziResult.outfit,
            imageUrl: '',
            age,
          } as BaZiResult,
          llmPlan,
        },
      }
    } finally {
      this.baziService.unregisterTask(taskId)
    }
  }

  /**
   * 仅重新生成穿搭方案（再测一次）。
   * 喜用神、幸运指数等八字推理结果沿用前端缓存传入的值，不重新调用 LLM 推理。
   */
  @Post('redesign')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async redesign(
    @Body()
    body: {
      mode: 'daily' | 'native'
      gender: string
      age?: number
      stylePreference?: string
      season: string
      yongShen: string
      xiShen: string
      dayMaster?: string
      clientTaskId?: string
    },
    @Req() req,
  ): Promise<{ data: { llmPlan: StylistResult } }> {
    const forwardHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>)
    const taskId = body.clientTaskId || uuidv4()
    const signal = this.baziService.registerTask(taskId)
    try {
      const llmPlan = await this.stylistService.generatePlan(
        {
          gender: body.gender === 'female' ? '女' : '男',
          age: body.age,
          season: body.season,
          stylePreference: body.stylePreference || '简约通勤风',
          yongShen: body.yongShen,
          xiShen: body.xiShen,
          dayMaster: body.dayMaster,
          mode: body.mode === 'native' ? 'native' : 'daily',
        },
        forwardHeaders,
        signal,
      )
      return { data: { llmPlan } }
    } finally {
      this.baziService.unregisterTask(taskId)
    }
  }

  @Post('generate-image')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async generateImage(
    @Body() body: { imagePrompt: string; taskId?: string; clientTaskId?: string },
    @Req() req,
  ): Promise<{ data: { imageUrl: string; imageKey: string; taskId: string } }> {
    const { imagePrompt, taskId: bodyTaskId, clientTaskId: bodyClientTaskId } = body
    const clientTaskId = bodyClientTaskId || bodyTaskId
    const taskId = clientTaskId || uuidv4()
    const forwardHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>)
    // 注册任务并将 signal 注入生图请求，用户退出时 /bazi/cancel 可真实中断
    const signal = this.baziService.registerTask(taskId)
    try {
      const generated = await this.baziService.generateOutfitImage(imagePrompt, forwardHeaders, taskId, signal)
      return { data: { imageUrl: generated.url, imageKey: generated.key, taskId } }
    } finally {
      this.baziService.unregisterTask(taskId)
    }
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
      clientTaskId?: string
    },
    @Req() req,
  ): Promise<{
    data: {
      tryOnUrl: string
      tryOnKey: string
    }
  }> {
    const { imageUrl, outfit, gender, age, clientTaskId } = body

    const forwardHeaders = HeaderUtils.extractForwardHeaders(
      req.headers as Record<string, string>,
    )

    const taskId = clientTaskId || uuidv4()
    const signal = this.baziService.registerTask(taskId)
    try {
      const generated = await this.baziService.generateTryOnImage(
        imageUrl,
        outfit,
        outfit.backgroundColor || '#F5F1E8',
        gender,
        age ?? 25,
        forwardHeaders,
        signal,
      )

      return {
        data: {
          tryOnUrl: generated.url,
          tryOnKey: generated.key,
        },
      }
    } finally {
      this.baziService.unregisterTask(taskId)
    }
  }
}
