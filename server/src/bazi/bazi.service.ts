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

/** 根据系统时间判断当前季节 */
function getCurrentSeason(): string {
  const month = new Date().getMonth() + 1
  if (month >= 3 && month <= 5) return '春季'
  if (month >= 6 && month <= 8) return '夏季'
  if (month >= 9 && month <= 11) return '秋季'
  return '冬季'
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
      gender: 'male' as const,
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

    const outfit = this.generateOutfit(favorableElement, favorableAnalysis, gender)

    return {
      dayMaster, dayMasterElement, fourPillars, fiveElements,
      favorableElement, favorableAnalysis, outfit,
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

  // ========== Outfit Generation ==========

  private generateOutfit(element: string, analysis?: FavorableAnalysis, gender: string = 'male'): OutfitRecommendation {
    const colors = ELEMENT_COLORS[element] || ['白色', '灰色']
    const style = OUTFIT_STYLES[element] || '简约百搭风'
    const bgColor = pickBackgroundColor(element)
    const season = getCurrentSeason()
    const mainColor = ELEMENT_MAIN_COLOR[element] || '白色'
    const genderText = gender === 'female' ? '女装' : '男装'
    const xiShen = analysis?.assistantXiShen || '白色'
    const xiShenColor = ELEMENT_MAIN_COLOR[xiShen] || '白色'

    let description = `您的八字喜用神为「${element}」`
    if (analysis) {
      description += `（${analysis.strength}，${analysis.logicSummary}）`
    }
    description += `，今日穿搭建议以${colors.join('、')}为主色调。${style}，助您运势亨通，气场全开。`

    const isFemale = gender === 'female'
    const bottomItem = isFemale ? '垂坠感醋酸中长裙' : '直筒西裤'
    const bagItem = isFemale ? '定型手提包（梯形或托特型）' : '商务公文包（方正硬挺款）'
    const shoeItem = isFemale ? '尖头中跟鞋（高度约5cm）' : '牛津皮鞋（圆头系带款）'
    const accessoryItems = isFemale
      ? '一条多层链条项链、一只细金属手镯和一副猫眼墨镜'
      : '一只精钢机械腕表和一副飞行员墨镜'
    const accessoryMaterial = isFemale
      ? '香槟金和玫瑰金的金属拉丝或宝石切割质感'
      : '银色精钢拉丝和哑光黑色质感'

    const prompt = `俯拍平铺式高定时尚广告摄影，${season} ${genderText} 成衣系列，${isFemale ? '女性优雅风格' : '男性商务风格'}，

【输出尺寸规格】
强制竖版 3:4 比例构图，顶部留白与底部留白比例为 1:2，确保画面重心稳定。

【拍摄背景】
采用 ${bgColor} 的平整细腻亚麻纹理背景布，背景布完全平铺无褶皱，营造极简高级画布感。

【主体穿搭 - 主色=用神】
核心单品为 ${mainColor} 的棉麻廓形${isFemale ? '西装外套（戗驳领设计）' : '西装外套（平驳领宽肩设计）'}，搭配同色系${bottomItem}，
面料需呈现清晰的天然肌理（哑光棉麻质感）。

【辅助单品 - 辅色=喜神】
配饰部分包含一只 ${xiShenColor} 的 ${bagItem} 和一双 ${xiShenColor} 的 ${shoeItem}，放置于服装右下方。

【点缀细节 - 点缀色】
${isFemale ? '首饰' : '配饰'}搭配包含${accessoryItems}，采用${accessoryMaterial}作为视觉亮点，保证搭配美观且色彩呼应。

【摆放构图与光影】
衣物与配饰采用不对称斜角布局，所有物品投影方向统一（左前方打光），在背景布上投射出柔和块状阴影，增强立体感与落地感。
四周留有大量留白（占比不少于35%），强调高端画册的排版呼吸感。

【色彩与质感控制】
整体色调倾向高级灰/莫兰迪色系（如遇主色为纯红或纯黑时，可适当提高饱和度至正常水平），避免荧光色或塑料质感。

【画质技术约束】
超写实商业摄影风格，8K高清，微距对焦，焦点精准锁定在${isFemale ? '项链吊坠' : '腕表表盘'}与${isFemale ? '墨镜镜片' : '墨镜镜片'}反光处，景深略浅以虚化背景布边缘。

【反向提示词】
不要出现假人模特、不要人脸、不要杂乱背景、不要褶皱堆叠、不要平淡无阴影的顶光、不要透视畸变、不要过度饱和的廉价色彩、不要额外多出的衣物或饰品${isFemale ? '' : '、不要女性化单品、不要裙装、不要高跟鞋'}。`

    return { style, colors, description, prompt, backgroundColor: bgColor, season }
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
