import { Injectable } from '@nestjs/common'
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk'

export interface OutfitPlan {
  top: string
  bottom: string
  outerwear: string | null
  shoes: string
  bag: string
  accessories: string[]
}

export interface LuckyColors {
  primary: string
  primaryHex: string
  secondary: string
  secondaryHex: string
  accent: string
  accentHex: string
  avoid: string[]
}

export interface StylistResult {
  luckyColors: LuckyColors
  styleTheme: string
  outfitPlan: OutfitPlan
  fabricSuggestion: string
  occasions: string[]
  imagePrompt: string
  negativePrompt: string
}

@Injectable()
export class StylistService {
  async generatePlan(
    params: {
      gender: string
      age?: number
      season: string
      stylePreference: string
      yongShen: string
      xiShen: string
      dayMaster?: string
    },
    headers?: Record<string, string>,
  ): Promise<StylistResult> {
    const {
      gender,
      age = 25,
      season,
      stylePreference,
      yongShen,
      xiShen,
      dayMaster,
    } = params

    const genderText = gender === 'female' || gender === '女' ? '女性' : '男性'
    const isFreeStyle = stylePreference === '自由搭配'
    const styleInstruction = isFreeStyle
      ? '用户无明确风格偏好，请根据五行用神/喜神、季节特点和性别年龄自由发挥，给出最适合的穿搭风格。'
      : `用户明确偏好「${stylePreference}」风格，请在该风格框架内进行搭配。`

    const prompt = `你是一位精通五行色彩学和现代时尚搭配的造型顾问。请根据以下用户信息生成一份结构化穿搭方案：

【用户信息】
- 性别：${genderText}
- 年龄：${age}岁
- 季节：${season}
- 穿搭风格偏好：${isFreeStyle ? '无明确偏好（自由搭配）' : stylePreference}
- ${styleInstruction}
- 八字日主：${dayMaster}
- 八字用神（最需要补的五行）：${yongShen}
- 八字喜神（辅助调候的五行）：${xiShen}

【输出要求】
请输出严格合法的 JSON，不要包含 markdown 代码块标记，不要添加任何解释性文字。JSON 结构如下：

{
  "luckyColors": {
    "primary": "主幸运色（对应用神，用于上衣/外套主体，需给出具体颜色名称如：米白色、香槟金、雾霾蓝）",
    "primaryHex": "主幸运色的 HEX 色值，仅用于结果页展示，必须以 # 开头，例如 #F5F5DC",
    "secondary": "辅助幸运色（对应喜神，用于下装/裤装，需给出具体颜色名称）",
    "secondaryHex": "辅助幸运色的 HEX 色值，仅用于结果页展示，必须以 # 开头",
    "accent": "点缀幸运色（用于鞋包配饰，需给出具体颜色名称）",
    "accentHex": "点缀幸运色的 HEX 色值，仅用于结果页展示，必须以 # 开头",
    "avoid": ["应避免的1-2种颜色"]
  },
  "styleTheme": "一句话概括今日穿搭主题，如：温柔知性的秋日通勤风",
  "outfitPlan": {
    "top": "具体上衣单品，含颜色和款式细节，如：米白色V领针织衫",
    "bottom": "具体下装单品，含颜色和款式细节",
    "outerwear": "外套单品，如不需要可填 null",
    "shoes": "具体鞋子，含颜色和材质",
    "bag": "具体包袋，含颜色和材质",
    "accessories": ["配饰1", "配饰2"]
  },
  "fabricSuggestion": "今日推荐面料，说明为什么适合这个季节",
  "occasions": ["适用场景1", "适用场景2"],
  "imagePrompt": "一段详细的英文 prompt，用于 AI 文生图生成平铺穿搭图。要求：flat lay photography, 1:1 square composition, solid color linen-textured background, all items fully visible within the frame with no cropping and no overlapping, generous spacing between items, clear boundaries. 采用中心展开式构图：上衣/外套平铺展开于画面上半部分，下装平铺展开于画面下半部分，鞋包配饰整齐摆放于画面右下角，配饰点缀于左下角或中心空白处。必须明确表达这是${genderText}穿搭（女性用 women's fashion / feminine styling，男性用 men's fashion / masculine styling）；必须包含所有单品、颜色、材质细节；突出高级感和设计感，避免纯色色块；背景干净有质感，光影柔和自然。禁止出现人物、面部、文字水印。",
  "negativePrompt": "英文反向提示词，必须排除不雅、变形、缺失单品、错误颜色、裁切单品、单品被遮挡、单品超出画面、单品堆叠混乱等问题；同时必须排除异性化单品：${genderText === '女性' ? '男装外套、领带、西装裤、宽大工装、男性皮鞋等' : '连衣裙、高跟鞋、蕾丝、荷叶边、短裙、女性手包等'}"
}

【性别差异化与高级感约束 - 必须严格执行】
用户是${genderText}，所有穿搭单品、风格描述、英文 imagePrompt 必须完全符合${genderText}时尚。禁止出现异性化单品或风格漂移。
1. 颜色必须严格围绕用神/喜神五行选择，用神对应主色，喜神对应辅色。
2. 单品必须真实存在，严格符合${genderText}审美和年龄，绝对不能出现异性化单品。
3. 风格偏好优先，性别气质兜底：穿搭必须首先满足用户选择的「风格偏好」气质。在风格框架内，再根据性别做气质微调：
   - 女性：轮廓以柔和、有曲线感为主，避免过度硬朗的男性化廓形；配饰精致小巧，鞋款优雅。
   - 男性：轮廓以利落、有结构感为主，避免过度柔化的女性化设计；配饰简洁有力，鞋款利落。
4. 避免风格冲突：单品选择不得与用户选择的风格偏好相矛盾。例如：商务通勤风不可出现蕾丝、荷叶边、甜美少女元素；甜美风不可出现正式西装、硬朗工装；运动风不可出现高跟鞋、正装皮鞋等。
5. 女性上衣必须有可见内搭（如衬衫/T恤/吊带），禁止真空、低胸、透视；男性上衣同样禁止真空。
6. 单品描述要有高级设计感：允许同色系深浅变化、面料纹理（条纹、格纹、暗纹、提花）、金属扣、珍珠扣、缝线、褶皱、荷叶边等细节，避免像纯色色块。
7. 整体造型参考韩系/通勤博主的穿搭质感：自然柔和的光影、不经意的精致、配色和谐、层次清晰、配饰点睛。
8. imagePrompt 英文描述中必须明确包含 women's fashion 或 men's fashion 关键词，且与性别一致；negativePrompt 必须排除异性化单品，但不能误排除本性别正常单品。
9. 只输出 JSON，不要任何额外文字。`

    const config = new Config()
    const forwardHeaders = headers ? HeaderUtils.extractForwardHeaders(headers) : undefined
    const client = new LLMClient(config, forwardHeaders)

    const messages = [{ role: 'user' as const, content: prompt }]
    const response = await client.invoke(messages, {
      model: 'kimi-k2-5-260127',
      thinking: 'disabled',
    })

    return this.parseResult(response.content)
  }

  private parseResult(content: string): StylistResult {
    try {
      // 尝试直接解析
      const data = JSON.parse(content)
      return this.normalizeResult(data)
    } catch {
      // 尝试从 markdown 代码块中提取
      const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (codeBlockMatch?.[1]) {
        const data = JSON.parse(codeBlockMatch[1].trim())
        return this.normalizeResult(data)
      }

      // 尝试提取第一个 { 到最后一个 }
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch?.[0]) {
        const data = JSON.parse(jsonMatch[0])
        return this.normalizeResult(data)
      }

      throw new Error('无法解析 LLM 返回的 JSON')
    }
  }

  private normalizeResult(data: Record<string, unknown>): StylistResult {
    const luckyColors = (data.luckyColors || {}) as LuckyColors
    return {
      luckyColors: {
        primary: String(luckyColors.primary || '米白色'),
        primaryHex: this.normalizeHex(String(luckyColors.primaryHex || '')),
        secondary: String(luckyColors.secondary || '浅灰色'),
        secondaryHex: this.normalizeHex(String(luckyColors.secondaryHex || '')),
        accent: String(luckyColors.accent || '金色'),
        accentHex: this.normalizeHex(String(luckyColors.accentHex || '')),
        avoid: Array.isArray(luckyColors.avoid) ? luckyColors.avoid : ['荧光色'],
      } as LuckyColors,
      styleTheme: String(data.styleTheme || '今日幸运穿搭'),
      outfitPlan: (data.outfitPlan || {
        top: '白色T恤',
        bottom: '蓝色牛仔裤',
        outerwear: null,
        shoes: '白色运动鞋',
        bag: '黑色斜挎包',
        accessories: ['银色项链'],
      }) as OutfitPlan,
      fabricSuggestion: String(data.fabricSuggestion || '棉麻混纺'),
      occasions: Array.isArray(data.occasions) ? data.occasions.map(String) : [],
      imagePrompt: String(data.imagePrompt || ''),
      negativePrompt: String(data.negativePrompt || ''),
    }
  }

  private normalizeHex(hex: string): string {
    const trimmed = hex.trim()
    if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed.toUpperCase()
    return '#9CA3AF'
  }
}
