import { Injectable } from '@nestjs/common'
import {
  ImageGenerationClient,
  Config,
  HeaderUtils,
} from 'coze-coding-dev-sdk'
import { calculateBaziChart } from '@openfate/bazi-engine'

// ========== Types ==========

export interface FourPillar {
  name: string
  stem: string
  branch: string
  ganZhi: string
  stemElement: string
  branchElement: string
  naYin: string
  tenGod: string
}

export interface OutfitRecommendation {
  style: string
  colors: string[]
  description: string
  prompt: string
}

interface BaZiResult {
  nickname: string
  gender: string
  dayMaster: string
  dayMasterElement: string
  fourPillars: FourPillar[]
  fiveElements: Array<{ name: string; count: number }>
  favorableElement: string
  outfit: OutfitRecommendation
}

// ========== Constants ==========

const ELEMENT_CN: Record<string, string> = {
  wood: '木',
  fire: '火',
  earth: '土',
  metal: '金',
  water: '水',
}

const ELEMENT_ENGLISH: Record<string, string> = {
  wood: 'Wood',
  fire: 'Fire',
  earth: 'Earth',
  metal: 'Metal',
  water: 'Water',
}

const ELEMENT_COLORS: Record<string, string[]> = {
  木: ['翠绿', '草绿', '青色'],
  火: ['朱红', '珊瑚红', '紫红'],
  土: ['米黄', '驼色', '棕色'],
  金: ['白色', '银色', '浅灰'],
  水: ['深蓝', '墨黑', '藏青'],
}

const OUTFIT_STYLES: Record<string, string> = {
  木: '自然清新风，棉麻材质，植物纹样，灵动飘逸',
  火: '热情活力风，利落剪裁，鲜明对比，时尚前卫',
  土: '稳重典雅风，大地色调，质感面料，简约大气',
  金: '精致干练风，金属质感，极简设计，高级面料',
  水: '深邃优雅风，流动线条，深色基调，神秘气质',
}

// 时辰 → 小时映射 (用于 @openfate/bazi-engine)
const SHICHEN_TO_HOUR: Record<string, number> = {
  子: 0,
  丑: 2,
  寅: 4,
  卯: 6,
  辰: 8,
  巳: 10,
  午: 12,
  未: 14,
  申: 16,
  酉: 18,
  戌: 20,
  亥: 22,
}

@Injectable()
export class BaziService {
  // ========== Main Calculation ==========

  calculateBaZi(
    birthDate: string,
    birthTime: string,
  ): Omit<BaZiResult, 'nickname' | 'gender'> {
    const [year, month, day] = birthDate.split('-').map(Number)

    // 从时辰字符串解析小时数
    let hour = 12
    for (const [key, h] of Object.entries(SHICHEN_TO_HOUR)) {
      if (birthTime.startsWith(key)) {
        hour = h
        break
      }
    }

    // 调用 @openfate/bazi-engine 进行专业排盘
    const chart = calculateBaziChart({
      year,
      month,
      day,
      hour,
      minute: 0,
      gender: 'male' as const,
    })

    // 构建四柱数据
    const pillarKeys = ['year', 'month', 'day', 'hour'] as const
    const pillarNames = ['年柱', '月柱', '日柱', '时柱']

    const fourPillars: FourPillar[] = pillarNames.map((name, i) => {
      const p = chart.pillars[pillarKeys[i]]
      if (!p) {
        return { name, stem: '', branch: '', ganZhi: '', stemElement: '', branchElement: '', naYin: '', tenGod: '' }
      }
      return {
        name,
        stem: p.stem,
        branch: p.branch,
        ganZhi: p.ganZhi,
        stemElement: ELEMENT_CN[p.element] || p.element,
        branchElement: ELEMENT_CN[p.branchElement] || p.branchElement,
        naYin: p.naYin || '',
        tenGod: p.stemTenGod || '',
      }
    })

    // 五行统计（天干 + 地支本气）
    const elementCount: Record<string, number> = {
      wood: 0,
      fire: 0,
      earth: 0,
      metal: 0,
      water: 0,
    }

    for (let i = 0; i < pillarKeys.length; i++) {
      const p = chart.pillars[pillarKeys[i]]
      if (!p) continue
      elementCount[p.element]++
      elementCount[p.branchElement]++
    }

    const fiveElements = Object.entries(elementCount).map(([en, count]) => ({
      name: ELEMENT_CN[en] || en,
      count,
    }))

    // 喜用神：五行中最弱的元素
    const sorted = [...fiveElements].sort((a, b) => a.count - b.count)
    const favorableElement = sorted[0].name

    // 日主信息
    const dayMaster = chart.dayMaster.char
    const dayMasterElement = ELEMENT_CN[chart.dayMaster.element] || chart.dayMaster.element

    // 生成穿搭推荐
    const outfit = this.generateOutfit(favorableElement)

    return {
      dayMaster,
      dayMasterElement,
      fourPillars,
      fiveElements,
      favorableElement,
      outfit,
    }
  }

  // ========== Outfit Generation ==========

  private generateOutfit(element: string): OutfitRecommendation {
    const colors = ELEMENT_COLORS[element] || ['白色', '灰色']
    const style = OUTFIT_STYLES[element] || '简约百搭风'
    const elementEn = ELEMENT_ENGLISH[Object.entries(ELEMENT_CN).find(([, cn]) => cn === element)?.[0] || ''] || 'Element'

    const description = `您的八字喜用神为「${element}」，今日穿搭建议以${colors.join('、')}为主色调。${style}，助您运势亨通，气场全开。`

    const prompt = `Top-down flat-lay fashion photography of a complete outfit arrangement on a natural linen fabric background. The outfit features ${elementEn} element color palette: ${colors.join(', ')}. Include a ${colors[0].toLowerCase()}-colored top or jacket as the main piece, paired with complementary bottom wear, a pair of elegant shoes, a minimalist bag, and subtle accessories. Soft natural daylight from above, clean and luxurious editorial style, high-end fashion magazine aesthetic. No text, no watermarks, no human figures. The overall mood should evoke ${style}. Shot from directly above, items neatly arranged with intentional spacing.`

    return { style, colors, description, prompt }
  }

  // ========== Image Generation ==========

  async generateOutfitImage(
    prompt: string,
    headers: Record<string, string>,
  ): Promise<string> {
    const config = new Config()
    const client = new ImageGenerationClient(config, headers)

    const response = await client.generate({
      prompt,
      size: '2K',
    })

    const helper = client.getResponseHelper(response)

    if (helper.success && helper.imageUrls.length > 0) {
      return helper.imageUrls[0]
    }

    throw new Error(
      `Image generation failed: ${helper.errorMessages.join(', ')}`,
    )
  }
}
