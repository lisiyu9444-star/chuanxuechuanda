import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk'
import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { db } from '@/storage/database/db'
import { fashionRatings } from '@/storage/database/schema'
import { getWxCredentials } from '@/auth/secrets'
import { getStorage, signKey } from '@/assets/tos-utils'

/** 多模态评分模型（与 stylist 同一可用模型，支持图片输入） */
const FASHION_MODEL = 'doubao-seed-2-0-pro-260215'

/** 等级称号表（65-89 逐分细分；≥90 与 <65 见 levelOf）。
    level 由服务端按分数强制映射输出，prompt 中等级表仅作 AI 点评语气参考，避免模型在 30 级细分中选错 */
const LEVEL_TITLES: Record<number, string> = {
  89: '穿搭担当', 88: '搭配老手', 87: '纯细节控', 86: '审美在线', 85: '品味靠谱',
  84: '心机叠满', 83: '搭配有料', 82: '穿搭有型', 81: '眼前一亮', 80: '值得种草',
  79: '渐入佳境', 78: '小有巧思', 77: '还在摸索', 76: '穿搭小白', 75: '勉强能看',
  74: '勉强及格', 73: '翻车边缘', 72: '白费努力', 71: '眼睛被辣', 70: '迷之搭配',
  69: '行为艺术', 68: '视觉冲击', 67: '灾难现场', 66: '精神污染', 65: '裸奔更佳',
}
/** 等级印章切图 TOS key（分数 → key）。v4 版：66-90 逐分 + 93/95 共 27 级，
    牌面底为 40% 不透明度的奶油金薄纱（透出照片不遮挡，文字线条不透明保持清晰）。
    仅 65/<65 无切图（返回 null，前端隐藏印章）。
    key 永久有效，返回前端时经 signKey 动态换签（30 天有效期） */
const STAMP_KEYS: Record<number, string> = {
  66: 'stamps/v4/level-66_0ebe95f0.png',
  67: 'stamps/v4/level-67_c8d2382e.png',
  68: 'stamps/v4/level-68_2e18a996.png',
  69: 'stamps/v4/level-69_78351eef.png',
  70: 'stamps/v4/level-70_f770959b.png',
  71: 'stamps/v4/level-71_439137fb.png',
  72: 'stamps/v4/level-72_c6a8827b.png',
  73: 'stamps/v4/level-73_27d64710.png',
  74: 'stamps/v4/level-74_86dffeab.png',
  75: 'stamps/v4/level-75_c3162d7b.png',
  76: 'stamps/v4/level-76_2e0aacb0.png',
  77: 'stamps/v4/level-77_7746f685.png',
  78: 'stamps/v4/level-78_bc39cfa3.png',
  79: 'stamps/v4/level-79_cee45cd1.png',
  80: 'stamps/v4/level-80_90276bde.png',
  81: 'stamps/v4/level-81_a61a5787.png',
  82: 'stamps/v4/level-82_8cd028dd.png',
  83: 'stamps/v4/level-83_23ef3823.png',
  84: 'stamps/v4/level-84_537246ed.png',
  85: 'stamps/v4/level-85_5c41d399.png',
  86: 'stamps/v4/level-86_4f5f4986.png',
  87: 'stamps/v4/level-87_a264e18b.png',
  88: 'stamps/v4/level-88_f242d53f.png',
  89: 'stamps/v4/level-89_8855e04f.png',
  90: 'stamps/v4/level-90_caabf89a.png',
  93: 'stamps/v4/level-93_934c31d9.png',
  95: 'stamps/v4/level-95_857f1ccd.png',
}
/** 每日评分次数上限：默认 99 便于测试；正式环境通过环境变量 FASHION_RATING_DAILY_LIMIT 调整为 3（PRD：登录用户 3 次/天） */
export const DAILY_LIMIT = Number(process.env.FASHION_RATING_DAILY_LIMIT) || 99
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
2. 搭配和谐度（65分）
   - 色彩和谐（25分）：配色是否协调或有视觉冲击力
   - 风格统一（20分）：是否形成清晰主题（通勤/运动/复古等）
   - 比例与层次（15分）：腰线、上下身比例、叠穿层次
   - 场合适配（5分）：是否适合日常休闲场景（默认按日常出行评判）
3. 人与衣的契合度（15分）
   - 个人适配（10分）：是否与体型、肤色、发型匹配，是否扬长避短
   - 个性表达（5分）：是否展现独特个性或态度

【评分等级】（level 字段必须严格按下表输出，称号均为"……的"式描述短语；shareTexts 中引用称号时用「」包裹）
- 95+  ："行走于秀场的"
- 90-94："这就是超模本模的"
- 85-89："被摄影师追着拍的"
- 80-84："衣品很能打的"
- 75-79："审美在线的"
- 70-74："搭配有巧思的"
- 65-69："挺有实验精神的"
- 60-64："穿出去胆儿挺肥的"
- 50-59："勇气可嘉型的"
- <50 ："Luo奔都比这强的"

【风格人格标签】
根据穿搭特征给出一个有创意、有辨识度的标签。从色彩偏好 × 风格倾向 × 大胆程度三个维度综合提炼。
示例："撞色冒险家""极简主义信徒""复古浪漫派""低调奢华型""日系盐系少年""法式慵懒派""街头潮流玩家""文艺知性风"

【输出格式】严格 JSON，不要输出其他内容：
{
  "totalScore": 82,
  "level": "衣品很能打的",
  "stylePersonality": "撞色冒险家",
  "wittyComment": "这身搭配像是从杂志里走出来的，但鞋子出卖了你——换个乐福鞋，你就是这条街最靓的仔！",
  "shareTexts": {
    "confident": "AI毒舌评审官给我打了82分，说我「衣品很能打的」！不服来战，让你见识下什么叫能打的衣品 #AI穿搭评分#",
    "selfDeprecating": "被AI毒舌评审官打了82分...说我「衣品很能打的」...才82分？这评审眼睛是租来的吗 #AI穿搭评分#"
  },
  "isInvalid": false,
  "imageWarning": null
}

【注意事项】
- 仅基于图片内容分析
- 点评保持幽默，如果低分可以更加毒舌一些，但不人身攻击
- 每次评分保持一致性（同一张图分数波动不超过 ±5 分）
- 趣味点评要有记忆点，适合朋友圈文案
- wittyComment 必须严格控制在 54 个汉字以内（含标点），超出则精简到 54 字以内，且必须是一句完整的话
- shareTexts 两条文案都必须把分数和「等级称号」自然织入，并带让人想转发/评论的钩子：confident 偏炫耀挑衅（高分时气场全开，低分时转为不服输的幽默反击）；selfDeprecating 偏自嘲吐槽（低分时幽默自黑，高分时转为凡尔赛式抱怨）`

/** 评分结果结构（与前端 src/types/fashion.ts 对应） */
export interface FashionRatingResult {
  totalScore: number
  level: string
  stylePersonality: string
  wittyComment: string
  shareTexts: { confident: string; selfDeprecating: string }
  isInvalid: boolean
  imageWarning?: string
  /** 等级印章切图签名 URL（30 天）。不入库，返回前端时按分数动态换签附加；无切图的分数段为 undefined */
  stampUrl?: string
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
        result: await this.attachStampUrl(row.result as FashionRatingResult),
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

  /** 分享场景查询单条记录（公开，无需登录；imageUrl 动态换签防过期），不存在返回 null */
  async getShared(id: string) {
    const rows = await db.select().from(fashionRatings).where(eq(fashionRatings.id, id)).limit(1)
    const row = rows[0]
    if (!row) return null
    return {
      id: row.id,
      imageUrl: await signKey(row.imageUrl),
      result: await this.attachStampUrl(row.result as FashionRatingResult),
      createdAt: row.createdAt,
    }
  }

  /** 按分数附加等级印章签名 URL（不入库，每次返回动态换签；无切图分数段/无效图不附加） */
  private async attachStampUrl(result: FashionRatingResult): Promise<FashionRatingResult> {
    if (result.isInvalid) return result
    const key = STAMP_KEYS[result.totalScore]
    if (!key) return result
    const stampUrl = await signKey(key)
    return stampUrl ? { ...result, stampUrl } : result
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

    return { id, imageUrl: publicUrl, result: await this.attachStampUrl(result), createdAt }
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
    // level 强制按分数由服务端 30 级表映射，AI 输出的 level 仅作参考不采用（细分称号防模型错配）
    const level = this.levelOf(score)
    const shareTexts = (parsed.shareTexts || {}) as { confident?: unknown; selfDeprecating?: unknown }
    const defaults = this.defaultShareTexts(score)
    return {
      totalScore: isInvalid ? 0 : score,
      level: isInvalid ? '无法评分' : level,
      stylePersonality: isInvalid ? '🙅 非穿搭照片' : String(parsed.stylePersonality || '神秘时尚客'),
      // 兜底截断：prompt 已要求 ≤54 字（展示 3 行 × 每行约 19 字，扣除前后引号），AI 仍可能超长
      wittyComment: String(parsed.wittyComment || '评审官陷入了沉思……').slice(0, 54),
      shareTexts: {
        confident: this.bindLevelToShareText(String(shareTexts.confident || defaults.confident), level, isInvalid),
        selfDeprecating: this.bindLevelToShareText(String(shareTexts.selfDeprecating || defaults.selfDeprecating), level, isInvalid),
      },
      isInvalid,
      ...(parsed.imageWarning ? { imageWarning: String(parsed.imageWarning) } : {}),
    }
  }

  private clampScore(score: number): number {
    if (Number.isNaN(score)) return 0
    return Math.min(100, Math.max(0, score))
  }

  /** 分数 → 等级称号映射（30 级细分：≥95 时尚馆藏 / ≥93 穿搭王者 / ≥90 时尚达人 / 65-89 查 LEVEL_TITLES / <65 统一兜底「不如不穿」） */
  private levelOf(score: number): string {
    if (score >= 95) return '时尚馆藏'
    if (score >= 93) return '穿搭王者'
    if (score >= 90) return '时尚达人'
    return LEVEL_TITLES[score] || '不如不穿'
  }

  /** 分享文案中「」包裹的称号引用统一替换为服务端映射等级（AI 按 prompt 示例生成的称号与最终 level 解耦后保持一致） */
  private bindLevelToShareText(text: string, level: string, isInvalid: boolean): string {
    if (isInvalid || !text.includes('「')) return text
    return text.replace(/「[^」]*」/g, `「${level}」`)
  }

  private defaultShareTexts(score: number) {
    const level = this.levelOf(score)
    return {
      confident: `AI毒舌评审官给我打了${score}分，说我「${level}」！不服来战 #AI穿搭评分#`,
      selfDeprecating: `被AI毒舌评审官打了${score}分……说我「${level}」……这评审眼睛是租来的吗 #AI穿搭评分#`,
    }
  }
}
