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
  love: number
  career: number
  family: number
  life: number
  study: number
  description: string
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
  generatedAt: number
}

export interface NativeResult {
  archiveId: string
  baziResult: BaZiResult
  llmPlan: StylistResult
  imageUrl?: string
  tryOnUrl?: string
  generatedAt: number
}

export interface ImageUnlockState {
  flat?: boolean
  tryOn?: boolean
}
