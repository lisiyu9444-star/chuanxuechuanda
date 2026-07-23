import { Injectable, HttpCode } from '@nestjs/common'
import {
  ImageGenerationClient,
  Config,
  HeaderUtils,
} from 'coze-coding-dev-sdk'

// ========== Types ==========

export interface FourPillar {
  name: string
  stem: string
  branch: string
  stemElement: string
  branchElement: string
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
  fourPillars: FourPillar[]
  fiveElements: Array<{ name: string; count: number }>
  favorableElement: string
  outfit: OutfitRecommendation
}

// ========== Constants ==========

const TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

const STEM_ELEMENT = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水']
const BRANCH_ELEMENT = ['水', '土', '木', '木', '土', '火', '火', '土', '金', '金', '土', '水']

const SHICHEN_TO_BRANCH = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

const ELEMENT_NAMES: Record<string, string> = {
  '木': '木',
  '火': '火',
  '土': '土',
  '金': '金',
  '水': '水',
}

const ELEMENT_ENGLISH: Record<string, string> = {
  '木': 'Wood',
  '火': 'Fire',
  '土': 'Earth',
  '金': 'Metal',
  '水': 'Water',
}

const ELEMENT_COLORS: Record<string, string[]> = {
  '木': ['翠绿', '草绿', '青色'],
  '火': ['朱红', '珊瑚红', '紫红'],
  '土': ['米黄', '驼色', '棕色'],
  '金': ['白色', '银色', '浅灰'],
  '水': ['深蓝', '墨黑', '藏青'],
}

const OUTFIT_STYLES: Record<string, string> = {
  '木': '自然清新风，棉麻材质，植物纹样，灵动飘逸',
  '火': '热情活力风，利落剪裁，鲜明对比，时尚前卫',
  '土': '稳重典雅风，大地色调，质感面料，简约大气',
  '金': '精致干练风，金属质感，极简设计，高级面料',
  '水': '深邃优雅风，流动线条，深色基调，神秘气质',
}

// Solar term approximate dates for month pillar determination
// [month, day] marks the start of each solar month
const SOLAR_TERMS = [
  { month: 1, day: 6 },   // 小寒 → 丑月(12)
  { month: 2, day: 4 },   // 立春 → 寅月(1)
  { month: 3, day: 6 },   // 惊蛰 → 卯月(2)
  { month: 4, day: 5 },   // 清明 → 辰月(3)
  { month: 5, day: 6 },   // 立夏 → 巳月(4)
  { month: 6, day: 6 },   // 芒种 → 午月(5)
  { month: 7, day: 7 },   // 小暑 → 未月(6)
  { month: 8, day: 7 },   // 立秋 → 申月(7)
  { month: 9, day: 8 },   // 白露 → 酉月(8)
  { month: 10, day: 8 },  // 寒露 → 戌月(9)
  { month: 11, day: 7 },  // 立冬 → 亥月(10)
  { month: 12, day: 7 },  // 大雪 → 子月(11)
]

@Injectable()
export class BaziService {
  // ========== Main Calculation ==========

  calculateBaZi(
    birthDate: string,
    birthTimeIndex: number,
  ): Omit<BaZiResult, 'nickname' | 'gender'> {
    const [year, month, day] = birthDate.split('-').map(Number)
    const hourBranch = SHICHEN_TO_BRANCH[birthTimeIndex]

    // Calculate four pillars
    const yearStemIdx = (year - 4) % 10
    const yearBranchIdx = (year - 4) % 12

    // Month pillar: determine lunar month from solar terms
    let lunarMonth = month
    if (day < SOLAR_TERMS[month - 1].day) {
      lunarMonth = month - 1
    }
    if (lunarMonth <= 0) lunarMonth = 12

    // Month branch: 寅(2) is month 1
    const monthBranchIdx = (lunarMonth + 1) % 12

    // Month stem: 五虎遁 (Five Tiger Escape)
    const yearStemGroup = yearStemIdx % 5
    const monthBaseStem = [2, 4, 6, 8, 0][yearStemGroup] // 丙,戊,庚,壬,甲
    const monthStemIdx = (monthBaseStem + lunarMonth - 1) % 10

    // Day pillar: using Julian Day Number
    const jdn = this.calcJDN(year, month, day)
    const dayStemIdx = ((jdn % 10) + 10) % 10
    const dayBranchIdx = ((jdn % 12) + 12) % 12

    // Hour stem: 五鼠遁 (Five Rat Escape)
    const dayStemGroup = dayStemIdx % 5
    const hourBaseStem = [0, 2, 4, 6, 8][dayStemGroup] // 甲,丙,戊,庚,壬
    const hourStemIdx = (hourBaseStem + hourBranch) % 10

    // Build four pillars
    const fourPillars: FourPillar[] = [
      {
        name: '年柱',
        stem: TIAN_GAN[yearStemIdx],
        branch: DI_ZHI[yearBranchIdx],
        stemElement: STEM_ELEMENT[yearStemIdx],
        branchElement: BRANCH_ELEMENT[yearBranchIdx],
      },
      {
        name: '月柱',
        stem: TIAN_GAN[monthStemIdx],
        branch: DI_ZHI[monthBranchIdx],
        stemElement: STEM_ELEMENT[monthStemIdx],
        branchElement: BRANCH_ELEMENT[monthBranchIdx],
      },
      {
        name: '日柱',
        stem: TIAN_GAN[dayStemIdx],
        branch: DI_ZHI[dayBranchIdx],
        stemElement: STEM_ELEMENT[dayStemIdx],
        branchElement: BRANCH_ELEMENT[dayBranchIdx],
      },
      {
        name: '时柱',
        stem: TIAN_GAN[hourStemIdx],
        branch: DI_ZHI[hourBranch],
        stemElement: STEM_ELEMENT[hourStemIdx],
        branchElement: BRANCH_ELEMENT[hourBranch],
      },
    ]

    // Five elements distribution
    const elementCount: Record<string, number> = {
      '木': 0, '火': 0, '土': 0, '金': 0, '水': 0,
    }
    for (const p of fourPillars) {
      elementCount[p.stemElement]++
      elementCount[p.branchElement]++
    }

    const fiveElements = Object.entries(elementCount).map(([name, count]) => ({
      name,
      count,
    }))

    // Determine favorable element (the one with minimum count)
    const sorted = [...fiveElements].sort((a, b) => a.count - b.count)
    const favorableElement = sorted[0].name

    // Generate outfit recommendation
    const outfit = this.generateOutfit(favorableElement)

    return { fourPillars, fiveElements, favorableElement, outfit }
  }

  // ========== Julian Day Number ==========

  private calcJDN(year: number, month: number, day: number): number {
    const a = Math.floor((14 - month) / 12)
    const y = year + 4800 - a
    const m = month + 12 * a - 3
    return (
      day +
      Math.floor((153 * m + 2) / 5) +
      365 * y +
      Math.floor(y / 4) -
      Math.floor(y / 100) +
      Math.floor(y / 400) -
      32045
    )
  }

  // ========== Outfit Generation ==========

  private generateOutfit(element: string): OutfitRecommendation {
    const colors = ELEMENT_COLORS[element] || ['白色', '灰色']
    const style = OUTFIT_STYLES[element] || '简约百搭风'
    const elementEn = ELEMENT_ENGLISH[element] || 'Element'

    const description = `您的八字喜用神为「${ELEMENT_NAMES[element]}」，今日穿搭建议以${colors.join('、')}为主色调。${style}，助您运势亨通，气场全开。`

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
