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

export interface FavorableAnalysis {
  dayMaster: string
  strength: string
  coreYongShen: string
  assistantXiShen: string
  taboo: string
  logicSummary: string
}

export interface OutfitRecommendation {
  style: string
  colors: string[]
  description: string
  prompt: string
  backgroundColor: string
  season: string
  bottomColor: string
  colorRule: string
}

interface BaZiResult {
  nickname: string
  gender: string
  dayMaster: string
  dayMasterElement: string
  fourPillars: FourPillar[]
  fiveElements: Array<{ name: string; count: number }>
  favorableElement: string
  favorableAnalysis: FavorableAnalysis
  outfit: OutfitRecommendation
  dailyYongShen?: string
  dailyXiShen?: string
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

// 天干 → 五行
const STEM_TO_ELEMENT: Record<string, string> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
  己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
}

// 地支 → 五行（本气）
const BRANCH_TO_ELEMENT: Record<string, string> = {
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
  午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
}

// 地支藏干
const BRANCH_HIDDEN_STEMS: Record<string, string[]> = {
  子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'],
  辰: ['戊', '乙', '癸'], 巳: ['丙', '庚', '戊'], 午: ['丁', '己'],
  未: ['己', '丁', '乙'], 申: ['庚', '壬', '戊'], 酉: ['辛'],
  戌: ['戊', '辛', '丁'], 亥: ['壬', '甲'],
}

// 五行相生：木→火→土→金→水→木
const GENERATES: Record<string, string> = {
  木: '火', 火: '土', 土: '金', 金: '水', 水: '木',
}

// 五行相克：木→土→水→火→金→木
const OVERCOMES: Record<string, string> = {
  木: '土', 土: '水', 水: '火', 火: '金', 金: '木',
}

// 被谁生（印星）
const GENERATED_BY: Record<string, string> = {
  木: '水', 火: '木', 土: '火', 金: '土', 水: '金',
}

// 被谁克（官杀）
const OVERCOMED_BY: Record<string, string> = {
  木: '金', 火: '水', 土: '木', 金: '火', 水: '土',
}

/** 五行对应颜色表（基础色 + 细分颜色） */
const ELEMENT_COLORS: Record<string, string[]> = {
  木: [
    '青翠色', '竹青色', '嫩草绿', '松石绿', '碧绿色',
    '柳叶绿', '薄荷绿', '春芽绿', '森林绿', '松柏绿',
    '苍翠绿', '嫩绿色', '豆绿色', '春草绿',
  ],
  火: [
    '赤红色', '朱砂红', '正红色', '火焰红', '紫罗兰',
    '丁香紫', '熏衣草紫', '葡萄紫', '珊瑚红', '绯红', '海棠红',
  ],
  土: [
    '明黄色', '金黄', '琥珀黄', '姜黄', '茶褐色',
    '咖啡色', '驼色', '卡其色', '土黄色', '棕褐色',
    '米黄色', '沙色', '暖黄色', '杏色', '奶油黄',
    '棕黄色', '赭石色', '芥末黄',
  ],
  金: [
    '纯白色', '雪白', '象牙白', '珍珠白', '银灰色',
    '铂金色', '香槟银', '月光银', '亮白色', '银白',
    '月白', '乳白色', '米白', '牡蛎白',
  ],
  水: [
    '纯黑色', '墨色', '炭黑', '曜石黑', '玄黑色',
    '深墨色', '午夜黑', '深蓝色', '藏青', '宝蓝',
    '深海蓝', '深黑色', '黛色', '鸦青',
  ],
}

/** 用神对应背景色映射表（同色系/中性色/撞色） */
const BACKGROUND_COLORS: Record<string, { same: string[]; neutral: string[]; contrast: string[] }> = {
  木: { same: ['浅薄荷绿', '米白'], neutral: ['暖灰', '燕麦色'], contrast: ['柔雾粉'] },
  火: { same: ['浅粉杏色', '裸色'], neutral: ['黑', '深灰'], contrast: ['牛仔蓝', '米白'] },
  土: { same: ['奶油色', '浅米色'], neutral: ['白色'], contrast: ['灰蓝'] },
  金: { same: ['浅香槟', '浅灰'], neutral: ['暖灰'], contrast: ['藏蓝', '墨绿'] },
  水: { same: ['浅蓝', '雾霾蓝'], neutral: ['米白'], contrast: ['浅橙', '杏色'] },
}

/** 五行对应主色（用于 prompt 中颜色描述） */
const ELEMENT_MAIN_COLOR: Record<string, string> = {
  木: '青绿色', 火: '赤红色', 土: '暖黄色', 金: '银白色', 水: '深蓝色',
}

/** 上下装配色映射表：每个用神对应的浅色/深色/中性色/同色系异调色 */
const BOTTOM_COLOR_MAP: Record<string, {
  light: string[]; dark: string[]; neutral: string[]; sameFamily: string[]
}> = {
  木: {
    light: ['薄荷绿', '嫩草绿', '浅豆绿', '春芽绿'],
    dark: ['森林绿', '松柏绿', '墨绿', '苍翠绿'],
    neutral: ['米白', '暖灰', '燕麦色', '卡其色'],
    sameFamily: ['竹青色', '松石绿', '碧绿色', '柳叶绿'],
  },
  火: {
    light: ['浅粉杏', '裸色', '珊瑚粉', '海棠粉'],
    dark: ['朱砂红', '正红色', '火焰红', '深紫红'],
    neutral: ['黑', '深灰', '米白', '驼色'],
    sameFamily: ['酒红', '砖红', '枫叶红', '石榴红'],
  },
  土: {
    light: ['奶油色', '浅米色', '杏色', '米黄'],
    dark: ['咖啡色', '深棕', '赭石色', '茶褐色'],
    neutral: ['白', '浅灰', '暖灰', '卡其色'],
    sameFamily: ['琥珀黄', '姜黄', '芥末黄', '棕黄色'],
  },
  金: {
    light: ['象牙白', '珍珠白', '浅香槟', '乳白色'],
    dark: ['银灰', '铂金色', '深灰', '烟灰色'],
    neutral: ['暖灰', '米白', '浅驼色', '燕麦色'],
    sameFamily: ['月光银', '银白', '月白', '牡蛎白'],
  },
  水: {
    light: ['雾霾蓝', '浅蓝', '天蓝', '冰蓝'],
    dark: ['藏青', '深海蓝', '午夜黑', '深墨色'],
    neutral: ['米白', '浅灰', '暖灰', '驼色'],
    sameFamily: ['宝蓝', '深湖蓝', '黛色', '鸦青'],
  },
}

/** 下装颜色生成法则 */
type ColorRule = '深浅' | '中性平衡' | '同色异调'

/** 根据用神主色生成下装颜色，遵循三大时尚法则 */
function generateBottomColor(element: string): { color: string; rule: string } {
  const map = BOTTOM_COLOR_MAP[element]
  if (!map) return { color: '米白色', rule: '中性平衡' }

  const rules: ColorRule[] = ['深浅', '中性平衡', '同色异调']
  const rule = rules[Math.floor(Math.random() * rules.length)]

  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)]

  switch (rule) {
    case '深浅': {
      // 主色偏深 → 选浅色下装；主色偏浅 → 选深色下装
      const mainColor = ELEMENT_MAIN_COLOR[element] || ''
      const isDarkMain = ['深蓝', '赤红', '深', '墨', '藏青'].some(d => mainColor.includes(d))
        || ['水', '火'].includes(element)
      const color = isDarkMain ? pick(map.light) : pick(map.dark)
      const desc = isDarkMain ? '深色上衣搭配浅色下装，制造视觉张力' : '浅色上衣搭配深色下装，稳重落地'
      return { color, rule: desc }
    }
    case '中性平衡': {
      const color = pick(map.neutral)
      return { color, rule: `鲜艳主色搭配${color}中性色下装，压制浮夸感` }
    }
    case '同色异调': {
      const color = pick(map.sameFamily)
      return { color, rule: `同色系异色调渐变，营造高级层次感` }
    }
  }
}

/** 根据系统时间判断当前季节 */
function getCurrentSeason(): string {
  const month = new Date().getMonth() + 1
  if (month >= 3 && month <= 5) return '春季'
  if (month >= 6 && month <= 8) return '夏季'
  if (month >= 9 && month <= 11) return '秋季'
  return '冬季'
}

/** 获取当前日期的干支历月日 */
export function getCurrentGanZhiDate(): { month: string; day: string } {
  try {
    const { Lunar } = require('lunar-javascript')
    const now = new Date()
    const lunar = Lunar.fromDate(now)
    return {
      month: lunar.getMonthInGanZhi(),
      day: lunar.getDayInGanZhi(),
    }
  } catch (error) {
    console.error('获取干支历日期失败:', error)
    return { month: '', day: '' }
  }
}

/** 获取当日日柱天干的五行 */
export function getDailyStemElement(): string {
  try {
    const { Lunar } = require('lunar-javascript')
    const now = new Date()
    const lunar = Lunar.fromDate(now)
    const dayGanZhi = lunar.getDayInGanZhi()  // 如"甲子"
    const dayStem = dayGanZhi[0]  // 如"甲"
    return STEM_TO_ELEMENT[dayStem] || '木'
  } catch (error) {
    console.error('获取日干五行失败:', error)
    return '木'
  }
}

/**
 * 根据命盘用神/喜神和日干五行，计算当日用神/喜神
 * 简化逻辑：
 * 1. 日干=用神 → 用神=命盘用神，喜神=命盘喜神（保持不变）
 * 2. 其他 → 用神根据日干调整，喜神随机选（不等于用神）
 */
export function getDailyFavorableElements(
  natalYongShen: string,
  natalXiShen: string,
  dayElement: string,
): { yongShen: string; xiShen: string } {
  // 确定当日用神
  let yongShen = natalYongShen
  
  if (GENERATES[dayElement] === natalYongShen) {
    // 日干生用神 → 用神=日干
    yongShen = dayElement
  } else if (dayElement === natalYongShen) {
    // 日干=用神 → 不变
    yongShen = natalYongShen
  } else if (GENERATES[natalYongShen] === dayElement) {
    // 用神生日干 → 用神=日干
    yongShen = dayElement
  } else if (OVERCOMES[dayElement] === natalYongShen) {
    // 日干克用神 → 用神=命盘喜神
    yongShen = natalXiShen
  } else if (OVERCOMES[natalYongShen] === dayElement) {
    // 用神克日干 → 不变
    yongShen = natalYongShen
  } else if (GENERATES[dayElement] === natalXiShen) {
    // 日干生喜神 → 用神=命盘喜神
    yongShen = natalXiShen
  } else if (dayElement === natalXiShen) {
    // 日干=喜神 → 用神=命盘喜神
    yongShen = natalXiShen
  }

  // 确定当日喜神
  let xiShen: string
  if (dayElement === natalYongShen) {
    // 日干=用神 → 喜神=命盘喜神（保持不变）
    xiShen = natalXiShen
  } else {
    // 其他 → 随机选，只要不等于用神
    const elements = ['木', '火', '土', '金', '水']
    const candidates = elements.filter(e => e !== yongShen)
    xiShen = candidates[Math.floor(Math.random() * candidates.length)]
  }

  return { yongShen, xiShen }
}

/** 根据用神选取背景色（70%中性色，30%撞色） */
function pickBackgroundColor(element: string): string {
  const bg = BACKGROUND_COLORS[element]
  if (!bg) return '暖灰'
  const rand = Math.random()
  if (rand < 0.7) {
    return bg.neutral[Math.floor(Math.random() * bg.neutral.length)]
  } else {
    return bg.contrast[Math.floor(Math.random() * bg.contrast.length)]
  }
}

const OUTFIT_STYLES: Record<string, string> = {
  木: '自然清新风，棉麻材质，植物纹样，灵动飘逸',
  火: '热情活力风，利落剪裁，鲜明对比，时尚前卫',
  土: '稳重典雅风，大地色调，质感面料，简约大气',
  金: '精致干练风，金属质感，极简设计，高级面料',
  水: '深邃优雅风，流动线条，深色基调，神秘气质',
}

// 时辰 → 小时映射
const SHICHEN_TO_HOUR: Record<string, number> = {
  子: 0, 丑: 2, 寅: 4, 卯: 6, 辰: 8, 巳: 10,
  午: 12, 未: 14, 申: 16, 酉: 18, 戌: 20, 亥: 22,
}

@Injectable()
export class BaziService {
  // 存储进行中的任务，用于取消
  private activeTasks = new Map<string, AbortController>()

  // ========== Main Calculation ==========

  calculateBaZi(
    birthDate: string,
    birthTime: string,
    gender: string = 'male',
  ): Omit<BaZiResult, 'nickname' | 'gender'> {
    const [year, month, day] = birthDate.split('-').map(Number)

    let hour = 12
    for (const [key, h] of Object.entries(SHICHEN_TO_HOUR)) {
      if (birthTime.startsWith(key)) {
        hour = h
        break
      }
    }

    const chart = calculateBaziChart({
      year, month, day, hour, minute: 0,
      gender: (gender === 'female' ? 'female' : 'male') as const,
    })

    const pillarKeys = ['year', 'month', 'day', 'hour'] as const
    const pillarNames = ['年柱', '月柱', '日柱', '时柱']

    const fourPillars: FourPillar[] = pillarNames.map((name, i) => {
      const p = chart.pillars[pillarKeys[i]]
      if (!p) {
        return { name, stem: '', branch: '', ganZhi: '', stemElement: '', branchElement: '', naYin: '', tenGod: '' }
      }
      return {
        name, stem: p.stem, branch: p.branch, ganZhi: p.ganZhi,
        stemElement: ELEMENT_CN[p.element] || p.element,
        branchElement: ELEMENT_CN[p.branchElement] || p.branchElement,
        naYin: p.naYin || '', tenGod: p.stemTenGod || '',
      }
    })

    // 五行统计（天干 + 地支本气 + 藏干）
    const elementCount: Record<string, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 }
    for (let i = 0; i < pillarKeys.length; i++) {
      const p = chart.pillars[pillarKeys[i]]
      if (!p) continue
      elementCount[p.element]++
      elementCount[p.branchElement]++
    }

    const fiveElements = Object.entries(elementCount).map(([en, count]) => ({
      name: ELEMENT_CN[en] || en, count,
    }))

    const dayMaster = chart.dayMaster.char
    const dayMasterElement = ELEMENT_CN[chart.dayMaster.element] || chart.dayMaster.element

    // 专业喜用神判定
    const favorableAnalysis = this.calculateFavorableElement(chart)
    const favorableElement = favorableAnalysis.coreYongShen
    const xiShenElement = favorableAnalysis.assistantXiShen

    // 计算当日用神/喜神（基于日干五行）
    const dayElement = getDailyStemElement()
    const dailyElements = getDailyFavorableElements(favorableElement, xiShenElement, dayElement)
    const dailyYongShen = dailyElements.yongShen
    const dailyXiShen = dailyElements.xiShen

    // 使用当日用神生成穿搭
    const outfit = this.generateOutfit(dailyYongShen, dailyXiShen, favorableAnalysis, gender)

    return {
      dayMaster, dayMasterElement, fourPillars, fiveElements,
      favorableElement, favorableAnalysis, outfit,
      dailyYongShen, dailyXiShen,
    }
  }

  // ========== 专业喜用神判定引擎 ==========

  private calculateFavorableElement(chart: ReturnType<typeof calculateBaziChart>): FavorableAnalysis {
    const { pillars } = chart

    // 提取天干地支
    const yearStem = pillars.year?.stem || ''
    const yearBranch = pillars.year?.branch || ''
    const monthStem = pillars.month?.stem || ''
    const monthBranch = pillars.month?.branch || ''
    const dayStem = pillars.day?.stem || ''
    const dayBranch = pillars.day?.branch || ''
    const hourStem = pillars.hour?.stem || ''
    const hourBranch = pillars.hour?.branch || ''

    // Step 1: 日主五行
    const dayMasterElement = STEM_TO_ELEMENT[dayStem] || '木'

    // Step 2: 判断日主强弱
    let score = 0
    const reasons: string[] = []

    // 得令（月支）
    const monthBranchElement = BRANCH_TO_ELEMENT[monthBranch] || '土'
    if (monthBranchElement === dayMasterElement || GENERATED_BY[dayMasterElement] === monthBranchElement) {
      score += 40
      reasons.push(`月支${monthBranch}（${monthBranchElement}）生扶日主 +40`)
    } else {
      score -= 20
      reasons.push(`月支${monthBranch}（${monthBranchElement}）克泄耗日主 -20`)
    }

    // 得地（地支藏干通根）
    const allBranches = [yearBranch, monthBranch, dayBranch, hourBranch]
    for (const branch of allBranches) {
      if (!branch) continue
      const hiddenStems = BRANCH_HIDDEN_STEMS[branch] || []
      for (const hStem of hiddenStems) {
        if (STEM_TO_ELEMENT[hStem] === dayMasterElement) {
          score += 20
          reasons.push(`${branch}藏干${hStem}（${dayMasterElement}）通根 +20`)
          break
        }
      }
    }

    // 得势（天干相助）
    const otherStems = [yearStem, monthStem, hourStem].filter(Boolean)
    for (const stem of otherStems) {
      const stemElement = STEM_TO_ELEMENT[stem]
      if (stemElement === dayMasterElement || stemElement === GENERATED_BY[dayMasterElement]) {
        score += 15
        reasons.push(`天干${stem}（${stemElement}）相助 +15`)
      }
    }

    // 判定强弱
    let strength: string
    if (score > 30) {
      strength = '身强'
    } else if (score < -10) {
      strength = '身弱'
    } else {
      strength = '中和'
    }

    // 统计所有五行力量（含藏干）
    const elementPower: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 }
    const allStems = [yearStem, monthStem, dayStem, hourStem].filter(Boolean)
    for (const stem of allStems) {
      elementPower[STEM_TO_ELEMENT[stem]]++
    }
    for (const branch of allBranches) {
      if (!branch) continue
      elementPower[BRANCH_TO_ELEMENT[branch]]++
      const hiddenStems = BRANCH_HIDDEN_STEMS[branch] || []
      for (const hStem of hiddenStems) {
        elementPower[STEM_TO_ELEMENT[hStem]] += 0.5
      }
    }

    const totalPower = Object.values(elementPower).reduce((a, b) => a + b, 0) || 1

    // Step 3: 调候优先检查
    const summerBranches = ['巳', '午', '未']
    const winterBranches = ['亥', '子', '丑']

    if (summerBranches.includes(monthBranch) && elementPower['水'] <= 1) {
      const yongShen = '水'
      const xiShen = GENERATED_BY[yongShen] // 金生水 → 金
      const taboo = OVERCOMES[yongShen] // 土克水 → 土
      return {
        dayMaster: `${dayStem}${dayMasterElement}`,
        strength: '调候',
        coreYongShen: yongShen,
        assistantXiShen: xiShen,
        taboo,
        logicSummary: `日主${dayStem}${dayMasterElement}生于${monthBranch}月（夏），火旺燥热，局中水弱，调候急迫，故取水为用神，金为喜神。`,
      }
    }

    if (winterBranches.includes(monthBranch) && elementPower['火'] <= 1) {
      const yongShen = '火'
      const xiShen = GENERATED_BY[yongShen] // 木生火 → 木
      const taboo = OVERCOMES[yongShen] // 水克火 → 水
      return {
        dayMaster: `${dayStem}${dayMasterElement}`,
        strength: '调候',
        coreYongShen: yongShen,
        assistantXiShen: xiShen,
        taboo,
        logicSummary: `日主${dayStem}${dayMasterElement}生于${monthBranch}月（冬），水寒冰冻，局中火弱，调候急迫，故取火为用神，木为喜神。`,
      }
    }

    // Step 4: 从格检查
    for (const [element, power] of Object.entries(elementPower)) {
      if (power / totalPower > 0.8) {
        const dayMasterHasRoot = allBranches.some(branch => {
          const hiddenStems = BRANCH_HIDDEN_STEMS[branch] || []
          return hiddenStems.some(hStem => STEM_TO_ELEMENT[hStem] === dayMasterElement)
        })
        const dayMasterHasHelp = otherStems.some(stem =>
          STEM_TO_ELEMENT[stem] === dayMasterElement || STEM_TO_ELEMENT[stem] === GENERATED_BY[dayMasterElement]
        )

        if (!dayMasterHasRoot && !dayMasterHasHelp) {
          const isSupportType = element === GENERATED_BY[dayMasterElement] || element === dayMasterElement
          if (isSupportType) {
            const yongShen = GENERATED_BY[element]
            const xiShen = element
            return {
              dayMaster: `${dayStem}${dayMasterElement}`,
              strength: '从旺格',
              coreYongShen: yongShen,
              assistantXiShen: xiShen,
              taboo: OVERCOMES[yongShen],
              logicSummary: `局中${element}气极旺（占比${Math.round(power / totalPower * 100)}%），日主无根无助，成从旺格，取${yongShen}为用神。`,
            }
          } else {
            const yongShen = element
            const xiShen = GENERATED_BY[element]
            return {
              dayMaster: `${dayStem}${dayMasterElement}`,
              strength: '从弱格',
              coreYongShen: yongShen,
              assistantXiShen: xiShen,
              taboo: OVERCOMES[yongShen],
              logicSummary: `局中${element}气极旺（占比${Math.round(power / totalPower * 100)}%），日主无根无助，成从弱格，取${yongShen}为用神。`,
            }
          }
        }
      }
    }

    // Step 5: 常规扶抑与通关
    let yongShen = ''
    let method = ''

    // 检查相战（两种元素都很强，需要通关）
    const sorted = Object.entries(elementPower).sort((a, b) => b[1] - a[1])
    const strongest = sorted[0]
    const secondStrongest = sorted[1]

    if (OVERCOMES[strongest[0]] === secondStrongest[0] && strongest[1] >= 3 && secondStrongest[1] >= 2) {
      // 相战：取通关五行
      yongShen = GENERATES[strongest[0]]
      method = `通关（${strongest[0]}${secondStrongest[0]}相战，取${yongShen}通关）`
    } else if (strength === '身强') {
      // 身强：克→泄→耗
      const guanSha = OVERCOMED_BY[dayMasterElement] // 克日主的
      if (elementPower[guanSha] > 0) {
        yongShen = guanSha
        method = '身强取官杀克制'
      } else {
        const shiShang = GENERATES[dayMasterElement] // 日主生的
        if (elementPower[shiShang] > 0) {
          yongShen = shiShang
          method = '身强取食伤泄秀'
        } else {
          yongShen = OVERCOMES[dayMasterElement] // 日主克的（财星）
          method = '身强取财星消耗'
        }
      }
    } else {
      // 身弱/中和：生→帮
      const yinXing = GENERATED_BY[dayMasterElement] // 生日主的（印星）
      if (elementPower[yinXing] > 0) {
        yongShen = yinXing
        method = '身弱取印星生扶'
      } else {
        yongShen = dayMasterElement // 比劫（同类）
        method = '身弱取比劫帮扶'
      }
    }

    // Step 6: 喜神（生助用神的五行）
    const xiShen = GENERATED_BY[yongShen]
    const taboo = OVERCOMES[yongShen]

    const logicSummary = `日主${dayStem}${dayMasterElement}，${strength}（得分${score}），${method}，取${yongShen}为用神，${xiShen}为喜神。`

    return {
      dayMaster: `${dayStem}${dayMasterElement}`,
      strength,
      coreYongShen: yongShen,
      assistantXiShen: xiShen,
      taboo,
      logicSummary,
    }
  }

  // ========== Outfit Item Pools & Random Selection ==========

  private static readonly FEMALE_ITEMS = {
    outerwear: [
      // formal（正式风）
      { desc: '西装外套（戗驳领收腰设计）', style: 'formal' },
      { desc: '双排扣西装马甲（修身剪裁）', style: 'formal' },
      { desc: '精纺羊毛西装（单粒扣直筒版型）', style: 'formal' },
      { desc: '垫肩西装外套（宽肩直身设计）', style: 'formal' },
      { desc: '缎面翻领西装（光泽面料）', style: 'formal' },
      // elegant（优雅风）
      { desc: '短款粗花呢外套（圆领无扣设计）', style: 'elegant' },
      { desc: '系带风衣（中长款收腰设计）', style: 'elegant' },
      { desc: '小香风外套（编织滚边设计）', style: 'elegant' },
      { desc: '真丝衬衫（飘带领设计）', style: 'elegant' },
      { desc: '羊绒披肩外套（流苏边设计）', style: 'elegant' },
      // casual（休闲风）
      { desc: '针织开衫（V领宽松版型）', style: 'casual' },
      { desc: '宽松棉麻衬衫（落肩设计）', style: 'casual' },
      { desc: '亚麻短外套（直筒版型）', style: 'casual' },
      { desc: '牛仔外套（oversize版型）', style: 'casual' },
      { desc: '连帽卫衣外套（抽绳设计）', style: 'casual' },
      // oriental（东方风）
      { desc: '立领盘扣上衣（改良中式版型）', style: 'oriental' },
      { desc: '对襟棉麻外套（手工盘扣）', style: 'oriental' },
      { desc: '斜襟交领上衣（水墨印花）', style: 'oriental' },
      { desc: '改良旗袍外套（立领斜襟）', style: 'oriental' },
      { desc: '中式刺绣披肩（丝质流苏）', style: 'oriental' },
    ],
    bottom: [
      // formal（正式风）
      { desc: '高腰阔腿裤（垂感面料）', style: 'formal' },
      { desc: '修身铅笔裙（膝上长度）', style: 'formal' },
      { desc: '精纺直筒西裤（中缝烫线）', style: 'formal' },
      { desc: 'A字及膝裙（挺括面料）', style: 'formal' },
      { desc: '锥形九分裤（高腰收脚）', style: 'formal' },
      // elegant（优雅风）
      { desc: '垂坠感醋酸中长裙（A字版型）', style: 'elegant' },
      { desc: '真丝半身长裙（百褶设计）', style: 'elegant' },
      { desc: '不规则下摆中长裙（前短后长）', style: 'elegant' },
      { desc: '缎面伞裙（过膝长度）', style: 'elegant' },
      { desc: '蕾丝拼接半裙（内衬打底）', style: 'elegant' },
      // casual（休闲风）
      { desc: '直筒九分裤（露踝设计）', style: 'casual' },
      { desc: '棉麻阔腿裤（松紧腰设计）', style: 'casual' },
      { desc: '高腰直筒牛仔裤（原色水洗）', style: 'casual' },
      { desc: '棉麻直筒裤（侧开叉设计）', style: 'casual' },
      { desc: '运动风束脚裤（侧条纹）', style: 'casual' },
      // oriental（东方风）
      { desc: '改良马面裙（刺绣腰封）', style: 'oriental' },
      { desc: '棉麻阔腿裤（盘扣腰头）', style: 'oriental' },
      { desc: '印花长裙（水墨晕染图案）', style: 'oriental' },
      { desc: '中式直筒裙（侧开叉设计）', style: 'oriental' },
      { desc: '刺绣阔腿裤（丝质面料）', style: 'oriental' },
    ],
    shoes: [
      // formal（正式风）
      { desc: '猫跟鞋（3.5cm尖头设计）', style: 'formal' },
      { desc: '切尔西短靴（尖头细跟）', style: 'formal' },
      { desc: '尖头高跟鞋（细跟8cm）', style: 'formal' },
      { desc: '方头粗跟鞋（5cm通勤款）', style: 'formal' },
      { desc: '系带牛津鞋（低跟3cm）', style: 'formal' },
      // elegant（优雅风）
      { desc: '尖头中跟鞋（细跟5cm）', style: 'elegant' },
      { desc: '芭蕾平底鞋（蝴蝶结装饰）', style: 'elegant' },
      { desc: '一字带凉鞋（中跟5cm）', style: 'elegant' },
      { desc: '玛丽珍鞋（搭扣圆头款）', style: 'elegant' },
      { desc: '细带高跟凉鞋（缠绕设计）', style: 'elegant' },
      // casual（休闲风）
      { desc: '方头粗跟穆勒鞋（4cm）', style: 'casual' },
      { desc: '厚底乐福鞋（3cm增高）', style: 'casual' },
      { desc: '编织凉鞋（平底绑带设计）', style: 'casual' },
      { desc: '帆布平底鞋（极简设计）', style: 'casual' },
      { desc: '皮质小白鞋（圆头厚底）', style: 'casual' },
      // oriental（东方风）
      { desc: '绣花布鞋（平底圆头款）', style: 'oriental' },
      { desc: '木屐凉鞋（日式厚底款）', style: 'oriental' },
      { desc: '盘扣平底鞋（丝质面料）', style: 'oriental' },
      { desc: '刺绣穆勒鞋（中式纹样）', style: 'oriental' },
      { desc: '竹编凉鞋（手工编织款）', style: 'oriental' },
    ],
    bag: [
      // formal（正式风）
      { desc: '定型手提包（梯形硬挺结构）', style: 'formal' },
      { desc: '方正公文包（磁扣翻盖款）', style: 'formal' },
      { desc: '结构化托特包（硬挺皮质）', style: 'formal' },
      { desc: '翻盖手提包（金属锁扣设计）', style: 'formal' },
      { desc: '简约手拿包（信封翻盖款）', style: 'formal' },
      // elegant（优雅风）
      { desc: '链条单肩包（小号翻盖设计）', style: 'elegant' },
      { desc: '信封手拿包（磁扣翻盖）', style: 'elegant' },
      { desc: '编织手提包（手工编织纹样）', style: 'elegant' },
      { desc: '竹节手柄包（复古设计）', style: 'elegant' },
      { desc: '珍珠扣链条包（晚宴款）', style: 'elegant' },
      // casual（休闲风）
      { desc: '帆布托特包（大号简约款）', style: 'casual' },
      { desc: '水桶包（抽绳收口设计）', style: 'casual' },
      { desc: '迷你斜挎包（链条肩带）', style: 'casual' },
      { desc: '皮质双肩包（迷你尺寸）', style: 'casual' },
      { desc: '半月包（弧形单肩设计）', style: 'casual' },
      // oriental（东方风）
      { desc: '刺绣手提包（丝质面料）', style: 'oriental' },
      { desc: '盘扣斜挎包（中式纹样）', style: 'oriental' },
      { desc: '竹编手提篮（手工编织）', style: 'oriental' },
      { desc: '流苏手拿包（丝质穗饰）', style: 'oriental' },
      { desc: '水墨印花布包（棉麻材质）', style: 'oriental' },
    ],
    accessories: [
      // formal（正式风）
      { desc: '精钢腕表（方形表盘）', style: 'formal' },
      { desc: '钻石耳钉（单颗6mm）', style: 'formal' },
      { desc: '金属袖扣（几何简约款）', style: 'formal' },
      { desc: '皮质腰带（金属方扣）', style: 'formal' },
      { desc: '胸针（金属徽章款）', style: 'formal' },
      // elegant（优雅风）
      { desc: '多层链条项链', style: 'elegant' },
      { desc: '珍珠耳钉（单颗8mm）', style: 'elegant' },
      { desc: '细金属手镯（开口设计）', style: 'elegant' },
      { desc: '猫眼墨镜（复古圆框）', style: 'elegant' },
      { desc: '真丝丝巾（小方巾系法）', style: 'elegant' },
      { desc: '珍珠项链（双层叠戴）', style: 'elegant' },
      { desc: '宝石胸针（花卉造型）', style: 'elegant' },
      // casual（休闲风）
      { desc: '金属耳环（几何圆环款）', style: 'casual' },
      { desc: '编织手链（多圈缠绕款）', style: 'casual' },
      { desc: '发箍（宽版布艺款）', style: 'casual' },
      { desc: '帆布腰带（金属插扣）', style: 'casual' },
      { desc: '运动风腕表（硅胶表带）', style: 'casual' },
      // oriental（东方风）
      { desc: '玉镯（圆形翡翠款）', style: 'oriental' },
      { desc: '流苏耳环（长款丝线款）', style: 'oriental' },
      { desc: '盘扣发簪（木质雕刻款）', style: 'oriental' },
      { desc: '中国结手链（红绳编织）', style: 'oriental' },
      { desc: '水墨纹丝巾（方形系法）', style: 'oriental' },
    ],
  }

  private static readonly MALE_ITEMS = {
    outerwear: [
      // formal（正式风）
      { desc: '西装外套（平驳领宽肩设计）', style: 'formal' },
      { desc: '粗花呢单西（修身单粒扣）', style: 'formal' },
      { desc: '精纺羊毛西装（单粒扣直筒版型）', style: 'formal' },
      { desc: '双排扣西装（戗驳领宽肩款）', style: 'formal' },
      { desc: '燕尾服外套（缎面翻领）', style: 'formal' },
      // elegant（优雅风）
      { desc: '针织西装外套（柔软垂感面料）', style: 'elegant' },
      { desc: '丝绒西装（光泽面料）', style: 'elegant' },
      { desc: '亚麻西装（透气轻薄款）', style: 'elegant' },
      { desc: '羊绒大衣（中长款系带）', style: 'elegant' },
      { desc: '真丝衬衫外套（飘带领设计）', style: 'elegant' },
      // casual（休闲风）
      { desc: '哈灵顿夹克（立领收腰设计）', style: 'casual' },
      { desc: '立领棉麻夹克（极简剪裁）', style: 'casual' },
      { desc: '棒球夹克（螺纹收口设计）', style: 'casual' },
      { desc: '牛仔夹克（原色直筒版型）', style: 'casual' },
      { desc: '宽松棉麻衬衫（落肩版型）', style: 'casual' },
      { desc: '针织polo衫（短袖翻领）', style: 'casual' },
      { desc: '亚麻短袖衬衫（直筒版型）', style: 'casual' },
      // oriental（东方风）
      { desc: '中式立领外套（盘扣设计）', style: 'oriental' },
      { desc: '立领盘扣外套（改良中式版型）', style: 'oriental' },
      { desc: '对襟棉麻外套（手工盘扣）', style: 'oriental' },
      { desc: '斜襟交领上衣（水墨印花）', style: 'oriental' },
      { desc: '唐装外套（立领对襟款）', style: 'oriental' },
    ],
    bottom: [
      // formal（正式风）
      { desc: '直筒西裤（中缝烫线设计）', style: 'formal' },
      { desc: '精纺西裤（无褶简约版型）', style: 'formal' },
      { desc: '锥形九分裤（高腰收脚）', style: 'formal' },
      { desc: '修身西装裤（无褶款）', style: 'formal' },
      { desc: '条纹西裤（商务正装款）', style: 'formal' },
      // elegant（优雅风）
      { desc: '垂感阔腿裤（丝质面料）', style: 'elegant' },
      { desc: '修身烟管裤（九分长度）', style: 'elegant' },
      { desc: '亚麻直筒裤（透气轻薄）', style: 'elegant' },
      { desc: '丝绒长裤（光泽面料）', style: 'elegant' },
      { desc: '羊毛锥形裤（高腰设计）', style: 'elegant' },
      // casual（休闲风）
      { desc: '修身九分裤（露踝设计）', style: 'casual' },
      { desc: '宽松阔腿裤（高腰打褶）', style: 'casual' },
      { desc: '原色牛仔裤（直筒卷边）', style: 'casual' },
      { desc: '卡其裤（经典斜纹面料）', style: 'casual' },
      { desc: '工装裤（侧口袋设计）', style: 'casual' },
      { desc: '棉麻长裤（松紧腰抽绳）', style: 'casual' },
      { desc: '运动风束脚裤（侧条纹）', style: 'casual' },
      { desc: '灯芯绒直筒裤（复古质感）', style: 'casual' },
      // oriental（东方风）
      { desc: '棉麻阔腿裤（盘扣腰头）', style: 'oriental' },
      { desc: '中式直筒裤（侧开叉设计）', style: 'oriental' },
      { desc: '刺绣阔腿裤（丝质面料）', style: 'oriental' },
      { desc: '改良灯笼裤（收脚设计）', style: 'oriental' },
      { desc: '水墨印花长裤（棉麻材质）', style: 'oriental' },
    ],
    shoes: [
      // formal（正式风）
      { desc: '牛津皮鞋（圆头系带款）', style: 'formal' },
      { desc: '德比皮鞋（开放式系带）', style: 'formal' },
      { desc: '孟克鞋（双扣带设计）', style: 'formal' },
      { desc: '翼纹牛津鞋（雕花设计）', style: 'formal' },
      { desc: '正装皮鞋（光面黑色款）', style: 'formal' },
      // elegant（优雅风）
      { desc: '乐福鞋（马衔扣装饰）', style: 'elegant' },
      { desc: '切尔西靴（圆头侧拉链）', style: 'elegant' },
      { desc: '麂皮乐福鞋（流苏装饰）', style: 'elegant' },
      { desc: '皮质短靴（圆头平底款）', style: 'elegant' },
      { desc: '编织皮鞋（手工缝线款）', style: 'elegant' },
      // casual（休闲风）
      { desc: '帆布鞋（低帮经典款）', style: 'casual' },
      { desc: '麂皮沙漠靴（系带款）', style: 'casual' },
      { desc: '运动凉鞋（男士宽条款）', style: 'casual' },
      { desc: '极简小白鞋（皮质圆头）', style: 'casual' },
      { desc: '一脚蹬懒人鞋（麂皮材质）', style: 'casual' },
      // oriental（东方风）
      { desc: '老北京布鞋（圆头平底款）', style: 'oriental' },
      { desc: '千层底布鞋（手工纳底）', style: 'oriental' },
      { desc: '盘扣布鞋（丝质面料）', style: 'oriental' },
      { desc: '刺绣布鞋（中式纹样）', style: 'oriental' },
      { desc: '竹编凉鞋（手工编织款）', style: 'oriental' },
    ],
    bag: [
      // formal（正式风）
      { desc: '商务公文包（方正硬挺款）', style: 'formal' },
      { desc: '手提公文包（磁扣翻盖）', style: 'formal' },
      { desc: '结构化托特包（商务款）', style: 'formal' },
      { desc: '翻盖手提包（金属锁扣）', style: 'formal' },
      { desc: '简约手拿包（信封翻盖）', style: 'formal' },
      // elegant（优雅风）
      { desc: '信封手拿包（磁扣款）', style: 'elegant' },
      { desc: '复古手提箱（迷你硬壳款）', style: 'elegant' },
      { desc: '皮质斜挎包（简约窄版）', style: 'elegant' },
      { desc: '皮质公文包（柔软皮质）', style: 'elegant' },
      { desc: '邮差包（复古皮质款）', style: 'elegant' },
      // casual（休闲风）
      { desc: '皮质邮差包（翻扣设计）', style: 'casual' },
      { desc: '帆布双肩包（极简设计）', style: 'casual' },
      { desc: '皮质托特包（大号手提款）', style: 'casual' },
      { desc: '尼龙斜挎包（轻便运动风）', style: 'casual' },
      { desc: '皮质腰包（简约窄版）', style: 'casual' },
      { desc: '帆布单肩包（文艺复古）', style: 'casual' },
      // oriental（东方风）
      { desc: '盘扣斜挎包（中式纹样）', style: 'oriental' },
      { desc: '水墨印花布包（棉麻材质）', style: 'oriental' },
    ],
    accessories: [
      // formal（正式风）
      { desc: '精钢机械腕表（蓝色表盘）', style: 'formal' },
      { desc: '金属袖扣（几何简约款）', style: 'formal' },
      { desc: '口袋方巾（亚麻折叠款）', style: 'formal' },
      { desc: '皮质腰带（金属方扣）', style: 'formal' },
      { desc: '领带夹（金属简约款）', style: 'formal' },
      // elegant（优雅风）
      { desc: '皮质表带腕表（棕色皮带）', style: 'elegant' },
      { desc: '银质戒指（极简宽版）', style: 'elegant' },
      { desc: '丝质口袋巾（花卉图案）', style: 'elegant' },
      { desc: '金属手镯（开口设计）', style: 'elegant' },
      { desc: '真丝围巾（小方巾系法）', style: 'elegant' },
      // casual（休闲风）
      { desc: '飞行员墨镜（金属框架）', style: 'casual' },
      { desc: '皮质手链（编织多圈款）', style: 'casual' },
      { desc: '钛钢项链（古巴链粗款）', style: 'casual' },
      { desc: '复古圆框墨镜（板材框架）', style: 'casual' },
      { desc: '帆布腰带（金属插扣）', style: 'casual' },
      // oriental（东方风）
      { desc: '玉佩挂件（翡翠雕刻款）', style: 'oriental' },
      { desc: '盘扣手链（木质雕刻）', style: 'oriental' },
      { desc: '中国结挂件（红绳编织）', style: 'oriental' },
      { desc: '水墨纹丝巾（方形系法）', style: 'oriental' },
      { desc: '竹节手镯（天然竹材）', style: 'oriental' },
    ],
  }

  /**
   * 随机选择单品组合，带风格连贯性逻辑
   * 规则：先随机选外套，以其风格为锚点，其他品类优先匹配同风格
   * 70%概率严格匹配同风格，30%概率混搭（增加多样性）
   */
  private selectOutfitItems(isFemale: boolean): {
    outerwear: string; bottom: string; shoes: string; bag: string; accessories: string; style: string
  } {
    const pool = isFemale ? BaziService.FEMALE_ITEMS : BaziService.MALE_ITEMS
    console.log('[selectOutfitItems] isFemale:', isFemale, 'pool:', isFemale ? 'FEMALE_ITEMS' : 'MALE_ITEMS')
    const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]

    // Step 1: 随机选外套，确定风格锚点
    const outerwear = pick(pool.outerwear)
    const anchorStyle = outerwear.style

    // 风格兼容矩阵：定义哪些风格可以混搭
    // formal 不能混搭 casual
    // oriental 不能混搭 casual
    // casual 不能混搭 oriental 和 formal
    const STYLE_COMPATIBILITY: Record<string, string[]> = {
      formal: ['formal', 'elegant', 'oriental'],
      elegant: ['elegant', 'formal', 'casual', 'oriental'],
      casual: ['casual', 'elegant'],
      oriental: ['oriental', 'elegant', 'formal'],
    }

    // Step 2: 其他品类按风格连贯性选择
    const selectByStyle = (items: { desc: string; style: string }[], matchRate: number) => {
      if (Math.random() < matchRate) {
        // 优先选同风格
        const sameStyle = items.filter(i => i.style === anchorStyle)
        if (sameStyle.length > 0) return pick(sameStyle)
      }
      // 否则从兼容风格中随机选
      const compatibleStyles = STYLE_COMPATIBILITY[anchorStyle] || [anchorStyle]
      const compatibleItems = items.filter(i => compatibleStyles.includes(i.style))
      if (compatibleItems.length > 0) return pick(compatibleItems)
      // 兜底：随机选
      return pick(items)
    }

    const bottom = selectByStyle(pool.bottom, 0.7)
    const shoes = selectByStyle(pool.shoes, 0.6)
    const bag = selectByStyle(pool.bag, 0.6)
    const accessories = selectByStyle(pool.accessories, 0.5)

    return {
      outerwear: outerwear.desc,
      bottom: bottom.desc,
      shoes: shoes.desc,
      bag: bag.desc,
      accessories: accessories.desc,
      style: anchorStyle,
    }
  }

  private generateOutfit(element: string, xiShenElement: string, analysis?: FavorableAnalysis, gender: string = 'male'): OutfitRecommendation {
    const colors = ELEMENT_COLORS[element] || ['白色', '灰色']
    const style = OUTFIT_STYLES[element] || '简约百搭风'
    const bgColor = pickBackgroundColor(element)
    const season = getCurrentSeason()
    const mainColor = ELEMENT_MAIN_COLOR[element] || '白色'
    const bottomColorResult = generateBottomColor(element)
    const bottomColor = bottomColorResult.color
    const colorRule = bottomColorResult.rule
    const genderText = gender === 'female' ? '女装' : '男装'
    const xiShen = xiShenElement || analysis?.assistantXiShen || '白色'
    const xiShenColor = ELEMENT_MAIN_COLOR[xiShen] || '白色'
    const isFemale = gender === 'female'
    console.log('[generateOutfit] gender:', gender, 'isFemale:', isFemale, 'genderText:', genderText)

    // 颜色冲突对（互补色/对比色）
    const COLOR_CONFLICTS = [
      ['红色', '绿色'], ['蓝色', '橙色'], ['黄色', '紫色'],
      ['青绿色', '赤红色'], ['深蓝色', '暖黄色'], ['青绿', '红'],
      ['蓝', '橙'], ['黄', '紫']
    ]
    // 中性色列表（冲突时的安全色）
    const NEUTRAL_ACCESSORY_COLORS = ['米白色', '浅灰色', '驼色', '裸色', '黑色']

    // 检查主色和喜神颜色是否冲突
    const hasColorConflict = COLOR_CONFLICTS.some(([a, b]) => 
      (mainColor.includes(a) && xiShenColor.includes(b)) ||
      (mainColor.includes(b) && xiShenColor.includes(a))
    )

    // 配饰颜色：只有颜色冲突时才使用中性色，否则使用喜神颜色
    const accessoryColor = hasColorConflict
      ? NEUTRAL_ACCESSORY_COLORS[Math.floor(Math.random() * NEUTRAL_ACCESSORY_COLORS.length)]
      : xiShenColor

    // 随机选择单品（风格连贯）
    const items = this.selectOutfitItems(isFemale)

    let description = `今日穿搭建议以${colors.join('、')}为主色调。${style}，助您运势亨通，气场全开。`

    const accessoryMaterial = isFemale
      ? '香槟金和玫瑰金的金属拉丝或宝石切割质感'
      : '银色精钢拉丝和哑光黑色质感'

    const styleMap: Record<string, string> = {
      formal: isFemale ? '女性精致通勤风格' : '男性精致商务风格',
      elegant: isFemale ? '女性优雅轻奢风格' : '男性优雅绅士风格',
      casual: isFemale ? '女性轻松日常风格' : '男性轻松休闲风格',
      oriental: isFemale ? '女性新中式风格' : '男性新中式风格',
    }
    const styleText = styleMap[items.style] || (isFemale ? '女性优雅风格' : '男性商务风格')

    const prompt = `俯拍平铺式高定时尚广告摄影，${season} ${genderText} 成衣系列，${styleText}，

【输出尺寸规格】
强制竖版 3:4 比例构图，顶部留白与底部留白比例为 1:2，确保画面重心稳定。

【拍摄背景】
采用 ${bgColor} 的平整细腻亚麻纹理背景布，背景布完全平铺无褶皱，营造极简高级画布感。

【主体穿搭 - 主色=用神】
核心单品为 ${mainColor} 的棉麻${items.outerwear}，搭配 ${bottomColor} 的棉麻${items.bottom}，
面料需呈现清晰的天然肌理（哑光棉麻质感）。

【辅助单品 - 辅色=喜神】
配饰部分包含一只 ${accessoryColor} 的 ${items.bag} 和一双 ${accessoryColor} 的 ${items.shoes}，放置于服装右下方。

【点缀细节 - 点缀色】
${isFemale ? '首饰' : '配饰'}搭配包含${items.accessories}，采用${accessoryMaterial}作为视觉亮点，保证搭配美观且色彩呼应。

【摆放构图与光影】
衣物与配饰采用不对称斜角布局，所有物品投影方向统一（左前方打光），在背景布上投射出柔和块状阴影，增强立体感与落地感。
四周留有大量留白（占比不少于35%），强调高端画册的排版呼吸感。

【色彩与质感控制】
避免荧光色或塑料质感，保持面料真实质感。

【画质技术约束】
商业摄影风格，画面清晰，焦点准确。

【反向提示词】
不要出现假人模特、不要人脸、不要杂乱背景、不要褶皱堆叠、不要平淡无阴影的顶光、不要透视畸变、不要过度饱和的廉价色彩${isFemale ? '' : '、不要女性化单品、不要裙装、不要高跟鞋、不要手提包、不要女士凉鞋、不要编织女鞋、不要丝巾、不要首饰'}。`

    return { style, colors, description, prompt, backgroundColor: bgColor, season, bottomColor, colorRule }
  }

  // ========== Image Generation ==========

  /**
   * 生成上身试穿图（图生图）
   * @param referenceImageUrl 平铺图 URL
   * @param outfit 穿搭单品描述
   * @param bgColor 背景色
   * @param gender 性别
   * @param headers 请求头
   * @returns 试穿图 URL
   */
  async generateTryOnImage(
    referenceImageUrl: string,
    outfit: OutfitRecommendation,
    bgColor: string,
    gender: string,
    headers: Record<string, string>,
  ): Promise<string> {
    const config = new Config()
    const filteredHeaders = { ...headers }
    delete filteredHeaders['x-faas-instance-name']
    delete filteredHeaders['X-Faas-Instance-Name']
    delete filteredHeaders['x-coze-instance-id']
    delete filteredHeaders['X-Coze-Instance-Id']
    const client = new ImageGenerationClient(config, filteredHeaders)

    const tryOnPrompt = `时尚杂志级模特上身试穿摄影，基于提供的平铺穿搭图进行真人试穿展示。

【输出尺寸规格】
强制竖版 3:4 比例构图。

【模特要求】
- ${gender === 'female' ? '亚洲女性模特，25-30 岁，身材匀称' : '亚洲男性模特，25-30 岁，身材挺拔'}
- 构图裁切至下巴以下，不展示面部（非涂抹遮挡，而是画面裁切）
- 自然站立姿势，正面或微侧身
- 发型简洁，不遮挡服装细节

【服装展示 - 必须完整展示所有单品】
- 穿搭风格：${outfit.style}
- 穿搭描述：${outfit.description}
- 推荐配色：${outfit.colors.join('、')}
- 上衣/外套：完整展示领口、袖口、纽扣等细节
- 下装：完整展示腰头、裤腿/裙摆
- 鞋子：必须完整展示，不可裁切脚部

【配饰佩戴规范 - 必须正确穿戴在身体上】
- 手镯/手链：必须佩戴在模特手腕上，保持正圆形/环形形态，不可变形为椭圆或扭曲，不可悬浮
- 项链：必须佩戴在颈部，自然垂落于胸前，链条形态清晰
- 耳环：必须佩戴在耳垂位置（面部虽裁切但耳垂区域应可见）
- 腰带：必须系在腰部，扣环清晰可见
- 包袋：手提或斜挎，保持正常立体形态
- 所有配饰必须与身体接触，不可悬浮或脱离人体
- 配饰保持正常几何形态，不可扭曲变形

【拍摄风格】
- 纯色背景（${bgColor}），与平铺图背景一致
- 影棚灯光，画面清晰
- 全身构图，从头顶到脚底完整展示，头顶留白 10%，脚底留白 5%

【反向提示词】
不要展示面部、不要裁切脚部或鞋子、不要配饰变形、不要配饰悬浮、不要手镯变成椭圆形、不要配饰脱离人体、不要夸张姿势、不要复杂背景、不要过度修图、不要改变服装颜色或款式、不要多人、不要文字水印。`

    const response = await client.generate({
      prompt: tryOnPrompt,
      size: '2K',
      
      image: referenceImageUrl,
    })

    const helper = client.getResponseHelper(response)

    if (helper.success && helper.imageUrls.length > 0) {
      return helper.imageUrls[0]
    }

    throw new Error(`Try-on image generation failed: ${helper.errorMessages.join(', ')}`)
  }

  async generateOutfitImage(
    prompt: string,
    headers: Record<string, string>,
    taskId?: string,
  ): Promise<string> {
    const config = new Config()
    // 过滤掉实例相关的 header，使用当前环境的实例 ID
    const filteredHeaders = { ...headers }
    delete filteredHeaders['x-faas-instance-name']
    delete filteredHeaders['X-Faas-Instance-Name']
    delete filteredHeaders['x-coze-instance-id']
    delete filteredHeaders['X-Coze-Instance-Id']
    const client = new ImageGenerationClient(config, filteredHeaders)

    // 如果提供了 taskId，创建 AbortController 并存储
    let abortController: AbortController | undefined
    if (taskId) {
      abortController = new AbortController()
      this.activeTasks.set(taskId, abortController)
      console.log('[GenerateImage] Task registered:', taskId, 'Active tasks:', Array.from(this.activeTasks.keys()))
    }

    try {
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
    } finally {
      // 任务完成后清理
      if (taskId) {
        this.activeTasks.delete(taskId)
      }
    }
  }

  // 取消任务
  cancelTask(taskId: string): boolean {
    console.log('[CancelService] Looking for taskId:', taskId, 'Active tasks:', Array.from(this.activeTasks.keys()))
    const controller = this.activeTasks.get(taskId)
    if (controller) {
      controller.abort()
      this.activeTasks.delete(taskId)
      console.log(`[CancelService] Task ${taskId} cancelled successfully`)
      return true
    }
    console.log(`[CancelService] Task ${taskId} not found in active tasks`)
    return false
  }
}
