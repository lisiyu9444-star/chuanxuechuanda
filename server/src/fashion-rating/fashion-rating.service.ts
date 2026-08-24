import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk'
import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { db } from '@/storage/database/db'
import { fashionRatings } from '@/storage/database/schema'
import { getWxCredentials } from '@/auth/secrets'
import { getStorage, signKey } from '@/assets/tos-utils'

/** 多模态评分模型（与 stylist 同一可用模型，支持图片输入） */
const FASHION_MODEL = 'doubao-seed-2-0-pro-260215'
/** 每日评分次数上限（PRD：登录用户 3 次/天） */
const DAILY_LIMIT = 3
/** 单张图片大小上限 10MB（PRD 6.1） */
const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

/** PRD 5.1 System Prompt（评分维度/等级/风格人格/严格 JSON 输出） */
const SYSTEM_PROMPT = `你是一位兼具专业眼光和幽默感的时尚穿搭评审专家，人称"AI毒舌时尚官"。

请仔细分析用户上传的这张穿搭照片，根据以下维度进行综合评分和详细点评。

【图片预处理判断】
在评分前，先判断图片质量：
- 图片模糊/过暗/过曝 → 在 imageWarning 字段填写提示（如"图片有点模糊，评分可能受影响哦～"），然后尽力评分
- 图中有多人 → 仅评价画面中最突出/居中的人物
- 不是穿搭照（风景/食物/宠物等）→ 设置 isInvalid=true，wittyComment 写幽默拒绝语（如"这位朋友，我是穿搭评审官，不是美食评委哦～"），其他字段填默认值

【评分维度】（总分100分）
1. 单品品质（20分）
评估每件单品的版型剪裁、色彩纯度、材质质感、工艺细节。
2. 搭配和谐度（50分）
   - 色彩和谐（15分）：配色是否协调或有视觉冲击力
   - 风格统一（15分）：是否形成清晰主题（通勤/运动/复古等）
   - 比例与层次（10分）：腰线、上下身比例、叠穿层次
   - 场合适配（10分）：是否适合日常休闲场景（默认按日常出行评判）
3. 人与衣的契合度（30分）
   - 个人适配（20分）：是否与体型、肤色、发型匹配，是否扬长避短
   - 个性表达（10分）：是否展现独特个性或态度

【评分等级】
- 95+ ："穿搭天花板"
- 90-94："穿搭王者"
- 80-89："时尚达人"
- 70-79："及格潮人"
- 60-69："勇敢尝试"
- 50-59："穿搭实验区"
- <50 ："今日翻车"

【风格人格标签】
根据穿搭特征给出一个有创意、有辨识度的标签。从色彩偏好 × 风格倾向 × 大胆程度三个维度综合提炼。
示例："撞色冒险家""极简主义信徒""复古浪漫派""低调奢华型""日系盐系少年""法式慵懒派""街头潮流玩家""文艺知性风"

【输出格式】严格 JSON，不要输出其他内容：
{
  "totalScore": 82,
  "level": "时尚达人",
  "stylePersonality": "撞色冒险家",
  "wittyComment": "这身搭配像是从杂志里走出来的，但鞋子出卖了你——换个乐福鞋，你就是这条街最靓的仔！",
  "shareTexts": {
    "confident": "AI毒舌评审官给我打了82分，说我是「撞色冒险家」，不服来战！ #AI穿搭评分#",
    "selfDeprecating": "被AI毒舌评审官打了82分...说鞋子出卖了我...你们觉得公平吗？ #AI穿搭评分#"
  },
  "isInvalid": false,
  "imageWarning": null
}

【注意事项】
- 仅基于图片内容分析
- 点评保持友善，即使低分也用建设性语气，绝不人身攻击
- 每次评分保持一致性（同一张图分数波动不超过 ±5 分）
- 趣味点评要有记忆点，适合朋友圈文案`

/** 评分结果结构（与前端 src/types/fashion.ts 对应） */
export interface FashionRatingResult {
  totalScore: number
  level: string
  stylePersonality: string
  wittyComment: string
  shareTexts: { confident: string; selfDeprecating: string }
  isInvalid: boolean
  imageWarning?: string
}

/** multer 上传文件（memoryStorage 模式下必有 buffer；path 兼容 diskStorage） */
interface UploadedImageFile {
  originalname: string
  mimetype: string
  size: number
  buffer?: Buffer
  path?: string
}

@Injectable()
export class FashionRatingService {
  /** 微信 access_token 进程缓存（有效期 7200s，提前 5 分钟续期） */
  private wxTokenCache: { token: string; expiresAt: number } | null = null

  /** 查询今日剩余次数 */
  async getRemaining(userId: string): Promise<number> {
    const used = await this.countToday(userId)
    return Math.max(0, DAILY_LIMIT - used)
  }

  /** 查询我的测评记录（倒序，imageUrl 动态换签防过期） */
  async list(userId: string) {
    const rows = await db
      .select()
      .from(fashionRatings)
      .where(eq(fashionRatings.userId, userId))
      .orderBy(desc(fashionRatings.createdAt))
      .limit(100)
    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        imageUrl: await signKey(row.imageUrl),
        result: row.result as FashionRatingResult,
        createdAt: row.createdAt,
      })),
    )
  }

  /** 删除我的测评记录（仅限本人），返回是否删除成功 */
  async remove(userId: string, id: string): Promise<boolean> {
    const deleted = await db
      .delete(fashionRatings)
      .where(and(eq(fashionRatings.id, id), eq(fashionRatings.userId, userId)))
      .returning({ id: fashionRatings.id })
    return deleted.length > 0
  }

  /**
   * 穿搭评分主流程（PRD 6.1）：
   * 文件校验 → 次数校验 → 微信图片安全审核 → TOS 上传 → 多模态 AI 评分 → 存库返回
   */
  async rate(
    userId: string,
    file: UploadedImageFile,
    headers?: Record<string, string>,
    signal?: AbortSignal,
  ) {
    // 1. 文件校验（memoryStorage 必有 buffer；path 为 diskStorage 兜底）
    const buffer = file.buffer?.length ? file.buffer : undefined
    if (!buffer) {
      throw new BadRequestException('图片读取失败，请重试')
    }
    const mime = (file.mimetype || '').toLowerCase()
    if (!ALLOWED_MIME.has(mime)) {
      throw new BadRequestException('仅支持 JPG/PNG/WebP 格式图片')
    }
    if (buffer.length > MAX_FILE_SIZE) {
      throw new BadRequestException('图片大小不能超过 10MB')
    }

    // 2. 次数校验（当日 0 点起计数，登录用户 3 次/天）
    const used = await this.countToday(userId)
    if (used >= DAILY_LIMIT) {
      throw new HttpException('今日评分次数已用完', HttpStatus.TOO_MANY_REQUESTS)
    }

    // 3. 微信图片安全审核（不通过 400；凭证未配置/超时/异常均降级放行并记录日志）
    const passed = await this.imgSecCheck(buffer)
    if (!passed) {
      throw new BadRequestException('图片不合规，请更换一张穿搭照片')
    }

    // 4. 上传 TOS（uploadFile 返回对象 key，key 永久有效），并签发公网可访问 URL（供大模型读取与前端展示）
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'
    const fileName = `fashion-rating/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const key = await getStorage().uploadFile({ fileContent: buffer, fileName, contentType: mime })
    const publicUrl = await signKey(key)
    console.log('[FashionRating] uploaded to TOS:', { userId, size: buffer.length, mime, key })

    // 5. 多模态 AI 评分
    const result = await this.invokeRating(publicUrl, headers, signal)
    console.log('[FashionRating] rating result:', { userId, score: result.totalScore, level: result.level, isInvalid: result.isInvalid })

    // 6. 存库（imageUrl 字段存对象 key，展示时动态签发 URL）
    const id = `fr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const createdAt = Date.now()
    await db.insert(fashionRatings).values({ id, userId, imageUrl: key, result, createdAt })

    return { id, imageUrl: publicUrl, result, createdAt }
  }

  /** 当日已评分次数（按 UTC+8 自然日统计） */
  private async countToday(userId: string): Promise<number> {
    const cnNow = new Date(Date.now() + 8 * 3600 * 1000)
    cnNow.setUTCHours(0, 0, 0, 0)
    const dayStart = cnNow.getTime() - 8 * 3600 * 1000
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(fashionRatings)
      .where(and(eq(fashionRatings.userId, userId), gte(fashionRatings.createdAt, dayStart)))
    return Number(rows[0]?.count ?? 0)
  }

  /** 获取微信 access_token（进程内缓存，提前 5 分钟过期续期；未配置凭证返回 null） */
  private async getWxAccessToken(): Promise<string | null> {
    const credentials = getWxCredentials()
    if (!credentials) return null
    const now = Date.now()
    if (this.wxTokenCache && this.wxTokenCache.expiresAt > now) {
      return this.wxTokenCache.token
    }
    try {
      const resp = await fetch(
        `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${credentials.appid}&secret=${credentials.secret}`,
      )
      const data = (await resp.json()) as { access_token?: string; expires_in?: number; errcode?: number; errmsg?: string }
      if (!data.access_token || !data.expires_in) {
        console.warn('[FashionRating] 获取微信 access_token 失败:', data)
        return null
      }
      this.wxTokenCache = { token: data.access_token, expiresAt: now + (data.expires_in - 300) * 1000 }
      return this.wxTokenCache.token
    } catch (error) {
      console.warn('[FashionRating] 请求微信 access_token 异常:', error instanceof Error ? error.message : error)
      return null
    }
  }

  /**
   * 微信图片安全审核 img_sec_check。
   * 返回 false 仅当微信明确判定违规（errcode 87014）；
   * 未配置凭证 / 3s 超时 / 其他异常均降级放行并记录日志（不阻断主流程）。
   */
  private async imgSecCheck(buffer: Buffer): Promise<boolean> {
    const token = await this.getWxAccessToken()
    if (!token) {
      console.warn('[FashionRating] 微信凭证未配置或不可用，跳过图片安全审核（降级放行）')
      return true
    }
    try {
      const form = new FormData()
      form.append('media', new Blob([new Uint8Array(buffer)], { type: 'image/jpeg' }), 'check.jpg')
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 3000)
      const resp = await fetch(`https://api.weixin.qq.com/wxa/img_sec_check?access_token=${token}`, {
        method: 'POST',
        body: form,
        signal: controller.signal,
      })
      clearTimeout(timer)
      const data = (await resp.json()) as { errcode?: number; errmsg?: string }
      if (data.errcode === 0) return true
      if (data.errcode === 87014) {
        console.warn('[FashionRating] img_sec_check 判定图片违规:', data)
        return false
      }
      // token 失效：清缓存下次重取；其他异常一律降级放行
      if (data.errcode === 40001 || data.errcode === 42001) this.wxTokenCache = null
      console.warn('[FashionRating] img_sec_check 返回异常（降级放行）:', data)
      return true
    } catch (error) {
      console.warn('[FashionRating] img_sec_check 请求失败（降级放行）:', error instanceof Error ? error.message : error)
      return true
    }
  }

  /** 调用多模态 LLM 评分（temperature 0.5；signal 场景直连底层 stream 支持取消） */
  private async invokeRating(
    imageUrl: string,
    headers?: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<FashionRatingResult> {
    const config = new Config()
    const forwardHeaders = headers ? HeaderUtils.extractForwardHeaders(headers) : undefined
    const client = new LLMClient(config, forwardHeaders)

    const messages = [
      {
        role: 'user' as const,
        content: [
          { type: 'text', text: `${SYSTEM_PROMPT}\n\n请开始评审这张穿搭照片，只输出 JSON。` },
          { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
        ],
      },
    ]

    let content = ''
    if (!signal) {
      const response = await client.invoke(messages as never, {
        model: FASHION_MODEL,
        thinking: 'disabled',
        temperature: 0.5,
      })
      content = response.content
    } else {
      // SDK invoke() 不暴露 signal，直连底层 LangChain stream 支持取消（同 StylistService 模式）
      const inner = client as unknown as {
        createLLM: (
          cfg: Record<string, unknown>,
          previousResponseId?: string,
          extraHeaders?: Record<string, string>,
        ) => {
          stream: (msgs: unknown, options?: { signal?: AbortSignal }) => Promise<AsyncIterable<{ content?: unknown }>>
        }
      }
      const llm = inner.createLLM({ model: FASHION_MODEL, thinking: 'disabled', temperature: 0.5 }, undefined, undefined)
      for await (const chunk of await llm.stream(messages, { signal })) {
        const part = chunk.content
        if (typeof part === 'string') content += part
        else if (Array.isArray(part)) content += part.map((p: { text?: string }) => p?.text || '').join('')
        else if (part) content += String(part)
      }
    }

    return this.parseResult(content)
  }

  /** 解析 LLM 输出：剥离代码块 → JSON.parse → 提取 JSON 块 → 正则降级（PRD 6.1） */
  private parseResult(content: string): FashionRatingResult {
    const cleaned = content.replace(/```(?:json)?/gi, '').trim()
    let parsed: Record<string, unknown> | null = null
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/)
      if (match) {
        try {
          parsed = JSON.parse(match[0])
        } catch {
          parsed = null
        }
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      // 终极降级：正则提取 totalScore，其余字段兜底
      const scoreMatch = cleaned.match(/"totalScore"\s*:\s*(\d+)/)
      const score = scoreMatch ? this.clampScore(parseInt(scoreMatch[1], 10)) : 0
      console.warn('[FashionRating] LLM 输出 JSON 解析失败，使用降级结果')
      return {
        totalScore: score,
        level: this.levelOf(score),
        stylePersonality: '神秘时尚客',
        wittyComment: '评审官今天有点词穷，但这身穿搭值得再来一次点评！',
        shareTexts: this.defaultShareTexts(score),
        isInvalid: false,
      }
    }

    const isInvalid = parsed.isInvalid === true
    const score = this.clampScore(parseInt(String(parsed.totalScore), 10) || 0)
    const shareTexts = (parsed.shareTexts || {}) as { confident?: unknown; selfDeprecating?: unknown }
    const defaults = this.defaultShareTexts(score)
    return {
      totalScore: isInvalid ? 0 : score,
      level: isInvalid ? '无法评分' : String(parsed.level || this.levelOf(score)),
      stylePersonality: isInvalid ? '🙅 非穿搭照片' : String(parsed.stylePersonality || '神秘时尚客'),
      wittyComment: String(parsed.wittyComment || '评审官陷入了沉思……'),
      shareTexts: {
        confident: String(shareTexts.confident || defaults.confident),
        selfDeprecating: String(shareTexts.selfDeprecating || defaults.selfDeprecating),
      },
      isInvalid,
      ...(parsed.imageWarning ? { imageWarning: String(parsed.imageWarning) } : {}),
    }
  }

  private clampScore(score: number): number {
    if (Number.isNaN(score)) return 0
    return Math.min(100, Math.max(0, score))
  }

  /** 分数 → 等级兜底映射（PRD 评分等级表） */
  private levelOf(score: number): string {
    if (score >= 95) return '穿搭天花板'
    if (score >= 90) return '穿搭王者'
    if (score >= 80) return '时尚达人'
    if (score >= 70) return '及格潮人'
    if (score >= 60) return '勇敢尝试'
    if (score >= 50) return '穿搭实验区'
    return '今日翻车'
  }

  private defaultShareTexts(score: number) {
    return {
      confident: `AI毒舌评审官给我打了${score}分，不服来战！ #AI穿搭评分#`,
      selfDeprecating: `被AI毒舌评审官打了${score}分……你们觉得公平吗？ #AI穿搭评分#`,
    }
  }
}
