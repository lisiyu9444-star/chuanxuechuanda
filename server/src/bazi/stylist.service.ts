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
  secondary: string
  accent: string
  avoid: string[]
}

export interface StylistResult {
  luckyColors: LuckyColors
  styleTheme: string
  stylingPrinciples: string[]
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

    const genderText = gender === 'female' ? '女性' : '男性'
    const prompt = `你是一位精通五行色彩学和现代时尚搭配的造型顾问。请根据以下用户信息生成一份结构化穿搭方案：

【用户信息】
- 性别：${genderText}
- 年龄：${age}岁
- 季节：${season}
- 穿搭风格偏好：${stylePreference}
- 八字日主：${dayMaster}
- 八字用神（最需要补的五行）：${yongShen}
- 八字喜神（辅助调候的五行）：${xiShen}

【输出要求】
请输出严格合法的 JSON，不要包含 markdown 代码块标记，不要添加任何解释性文字。JSON 结构如下：

{
  "luckyColors": {
    "primary": "主幸运色（对应用神，用于上衣/外套主体，需给出具体颜色名称如：米白色、香槟金、雾霾蓝）",
    "secondary": "辅助幸运色（对应喜神，用于下装/裤装，需给出具体颜色名称）",
    "accent": "点缀幸运色（用于鞋包配饰，需给出具体颜色名称）",
    "avoid": ["应避免的1-2种颜色"]
  },
  "styleTheme": "一句话概括今日穿搭主题，如：温柔知性的秋日通勤风",
  "stylingPrinciples": [
    "结合用神五行的搭配原则1",
    "结合喜神五行的搭配原则2",
    "结合季节和风格的建议3",
    "避免踩雷的提示4"
  ],
  "outfitPlan": {
    "top": "具体上衣单品，含颜色和款式细节，如：米白色V领针织衫",
    "bottom": "具体下装单品，含颜色和款式细节",
    "outerwear": "外套单品，如不需要可填 null",
    "shoes": "具体鞋子，含颜色和材质",
    "bag": "具体包袋，含颜色和材质",
    "accessories": ["配饰1", "配饰2"]
  },
  "fabricSuggestion": "今日推荐面料，说明为什么适合这个季节和五行",
  "occasions": ["适用场景1", "适用场景2"],
  "imagePrompt": "一段详细的英文 prompt，用于 AI 文生图生成平铺穿搭图。要求：flat lay photography, 3:4 vertical composition, solid color background, all items neatly arranged, natural soft lighting, high-end fashion magazine style. 必须包含所有单品、颜色、材质细节，禁止出现人物、面部、文字水印。",
  "negativePrompt": "英文反向提示词，用于排除不雅、变形、缺失单品、错误颜色等问题"
}

【重要约束】
1. 颜色必须严格围绕用神/喜神五行选择，用神对应主色，喜神对应辅色。
2. 单品必须真实存在，符合性别和年龄，不能出现异性化单品。
3. 风格偏好必须强烈体现，如可爱风要有明显少女感/少年感元素。
4. 上衣必须有可见内搭（如衬衫/T恤/吊带），禁止真空、低胸、透视。
5. 单品描述要有设计感：允许同色系深浅变化、面料纹理、金属扣、缝线等细节，避免像纯色色块。
6. 只输出 JSON，不要任何额外文字。`

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
    return {
      luckyColors: (data.luckyColors || {
        primary: '米白色',
        secondary: '浅灰色',
        accent: '金色',
        avoid: ['荧光色'],
      }) as LuckyColors,
      styleTheme: String(data.styleTheme || '今日幸运穿搭'),
      stylingPrinciples: Array.isArray(data.stylingPrinciples)
        ? data.stylingPrinciples.map(String)
        : [],
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
}
