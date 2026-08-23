import type { BaZiResult, StylistResult } from './bazi'

export type { StylistResult }

export interface Archive {
  id: string
  nickname: string
  gender: 'male' | 'female'
  calendarType: 'solar' | 'lunar'
  birthDate: string
  birthTime: string
  location: string
  age: number
  stylePreference: string
  isDefault: boolean
  createdAt: number
  updatedAt: number
}

export interface LuckyScore {
  total: number
  /** 气场 */
  aura: number
  /** 事业 */
  career: number
  /** 桃花 */
  romance: number
  /** 放松 */
  relax: number
  /** 灵感 */
  inspiration: number
  description: string
}

/**
 * 归一化幸运指数：兼容历史缓存中的旧字段（love/family/life/study），
 * 统一转换为展示五维（气场/事业/桃花/放松/灵感）。
 */
export function normalizeLuckyScore(raw: unknown): LuckyScore {
  const data = (raw ?? {}) as Record<string, unknown>
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  return {
    total: num(data.total),
    aura: num(data.aura ?? data.love),
    career: num(data.career),
    romance: num(data.romance ?? data.family),
    relax: num(data.relax ?? data.life),
    inspiration: num(data.inspiration ?? data.study),
    description: typeof data.description === 'string' ? data.description : '',
  }
}

export interface DailyResult {
  date: string
  archiveId: string
  luckyScore: LuckyScore
  baziResult: BaZiResult
  llmPlan: StylistResult
  ganZhiDate: { month: string; day: string }
  dailyYongShen: string
  dailyXiShen: string
  imageUrl?: string
  tryOnUrl?: string
  /** 平铺图对象 key（永久有效，URL 过期后可凭 key 换签） */
  imageKey?: string
  /** 试穿图对象 key */
  tryOnKey?: string
  generatedAt: number
}

export interface NativeResult {
  archiveId: string
  baziResult: BaZiResult
  llmPlan: StylistResult
  imageUrl?: string
  tryOnUrl?: string
  /** 平铺图对象 key（永久有效，URL 过期后可凭 key 换签） */
  imageKey?: string
  /** 试穿图对象 key */
  tryOnKey?: string
  generatedAt: number
}

export interface ImageUnlockState {
  flat?: boolean
  tryOn?: boolean
}
