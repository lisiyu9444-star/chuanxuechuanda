export interface LuckyColors {
  primary: string
  primaryHex?: string
  secondary: string
  secondaryHex?: string
  accent: string
  accentHex?: string
  avoid: string[]
}

export interface OutfitPlan {
  top: string
  bottom: string
  outerwear: string | null
  shoes: string
  bag: string
  accessories: string[]
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

export interface FavorableAnalysis {
  dayMaster: string
  strength: string
  coreYongShen: string
  assistantXiShen: string
  taboo: string
  logicSummary: string
}

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

export interface OutfitInfo {
  style: string
  colors: string[]
  description: string
  prompt: string
  backgroundColor?: string
  season?: string
}

export interface BaZiResult {
  nickname: string
  gender: string
  dayMaster: string
  dayMasterElement: string
  fourPillars: FourPillar[]
  fiveElements: Array<{ name: string; count: number }>
  favorableElement: string
  favorableAnalysis: FavorableAnalysis
  outfit?: OutfitInfo
  imageUrl: string
  /** 平铺图对象 key（永久有效，URL 过期后可凭 key 换签） */
  imageKey?: string
  age?: number
  ganZhiDate?: { month: string; day: string }
  dailyYongShen?: string
  dailyXiShen?: string
  llmPlan?: StylistResult
}

export interface HistoryRecord extends BaZiResult {
  id: string
  archiveId: string
  date?: string
  mode: 'daily' | 'native'
  birthDate: string
  birthTime: string
  city: string
  tryOnUrl?: string
  /** 平铺图对象 key（永久有效，URL 过期后可凭 key 换签） */
  imageKey?: string
  /** 试穿图对象 key */
  tryOnKey?: string
  createdAt: number
}
