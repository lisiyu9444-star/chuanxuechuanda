import Taro from '@tarojs/taro'
import type { Archive, DailyResult, NativeResult, ImageUnlockState } from '@/types/archive'

const ARCHIVES_KEY = 'outfit_archives'
const CURRENT_ARCHIVE_ID_KEY = 'current_archive_id'
const DAILY_RESULTS_KEY = 'daily_results'
const NATIVE_RESULTS_KEY = 'native_results'
const IMAGE_UNLOCKS_KEY = 'image_unlocks'

export const DEFAULT_ARCHIVE: Archive = {
  id: 'default',
  nickname: '示例档案',
  gender: 'female',
  calendarType: 'solar',
  birthDate: '1998-03-15',
  birthTime: '午时 (11:00-13:00)',
  location: '上海',
  age: 27,
  stylePreference: '率性工装风',
  isDefault: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

export function getToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function safeGet<T>(key: string, fallback: T): T {
  try {
    const value = Taro.getStorageSync(key)
    return value !== undefined && value !== null && value !== '' ? value : fallback
  } catch {
    return fallback
  }
}

function safeSet(key: string, value: unknown): void {
  try {
    Taro.setStorageSync(key, value)
  } catch (e) {
    console.error(`[archiveStorage] set ${key} failed`, e)
  }
}

// Archives
export function getArchives(): Archive[] {
  const list = safeGet<Archive[]>(ARCHIVES_KEY, [DEFAULT_ARCHIVE])
  if (!Array.isArray(list) || list.length === 0) {
    return [DEFAULT_ARCHIVE]
  }
  return list
}

export function saveArchive(archive: Archive): void {
  const list = getArchives()
  const index = list.findIndex(a => a.id === archive.id)
  if (index >= 0) {
    list[index] = { ...archive, updatedAt: Date.now() }
  } else {
    list.push({ ...archive, updatedAt: Date.now() })
  }
  safeSet(ARCHIVES_KEY, list)
}

export function deleteArchive(id: string): void {
  let list = getArchives()
  list = list.filter(a => a.id !== id)
  if (list.length === 0) {
    list = [DEFAULT_ARCHIVE]
  }
  safeSet(ARCHIVES_KEY, list)

  // 如果删除的是当前选中的，切换为第一个
  const currentId = getCurrentArchiveId()
  if (currentId === id) {
    setCurrentArchiveId(list[0].id)
  }
}

export function getArchiveById(id: string): Archive | undefined {
  return getArchives().find(a => a.id === id)
}

export function getCurrentArchiveId(): string {
  return safeGet<string>(CURRENT_ARCHIVE_ID_KEY, DEFAULT_ARCHIVE.id)
}

export function setCurrentArchiveId(id: string): void {
  safeSet(CURRENT_ARCHIVE_ID_KEY, id)
}

export function getCurrentArchive(): Archive {
  return getArchiveById(getCurrentArchiveId()) || DEFAULT_ARCHIVE
}

export function hasRealArchive(): boolean {
  return getArchives().some(a => !a.isDefault)
}

export function generateArchiveId(): string {
  return `archive_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

// Daily results
export function getDailyResultKey(archiveId: string, date: string): string {
  return `${archiveId}:${date}`
}

export function getDailyResults(): Record<string, DailyResult> {
  return safeGet<Record<string, DailyResult>>(DAILY_RESULTS_KEY, {})
}

export function getDailyResult(archiveId: string, date: string = getToday()): DailyResult | undefined {
  return getDailyResults()[getDailyResultKey(archiveId, date)]
}

export function saveDailyResult(result: DailyResult): void {
  const map = getDailyResults()
  map[getDailyResultKey(result.archiveId, result.date)] = result
  safeSet(DAILY_RESULTS_KEY, map)
}

export function clearDailyResult(archiveId: string, date: string = getToday()): void {
  const map = getDailyResults()
  delete map[getDailyResultKey(archiveId, date)]
  safeSet(DAILY_RESULTS_KEY, map)
}

// Native results
export function getNativeResults(): Record<string, NativeResult> {
  return safeGet<Record<string, NativeResult>>(NATIVE_RESULTS_KEY, {})
}

export function getNativeResult(archiveId: string): NativeResult | undefined {
  return getNativeResults()[archiveId]
}

export function saveNativeResult(result: NativeResult): void {
  const map = getNativeResults()
  map[result.archiveId] = result
  safeSet(NATIVE_RESULTS_KEY, map)
}

// Image unlocks
export function getImageUnlocks(): Record<string, ImageUnlockState> {
  return safeGet<Record<string, ImageUnlockState>>(IMAGE_UNLOCKS_KEY, {})
}

export function getImageUnlock(archiveId: string, date: string = getToday()): ImageUnlockState {
  return getImageUnlocks()[getDailyResultKey(archiveId, date)] || {}
}

export function setImageUnlock(archiveId: string, date: string = getToday(), state: ImageUnlockState): void {
  const map = getImageUnlocks()
  const key = getDailyResultKey(archiveId, date)
  map[key] = { ...map[key], ...state }
  safeSet(IMAGE_UNLOCKS_KEY, map)
}

export function clearAllStorage(): void {
  try {
    Taro.removeStorageSync(ARCHIVES_KEY)
    Taro.removeStorageSync(CURRENT_ARCHIVE_ID_KEY)
    Taro.removeStorageSync(DAILY_RESULTS_KEY)
    Taro.removeStorageSync(NATIVE_RESULTS_KEY)
    Taro.removeStorageSync(IMAGE_UNLOCKS_KEY)
  } catch (e) {
    console.error('[archiveStorage] clear failed', e)
  }
}

export type { Archive, DailyResult, NativeResult, ImageUnlockState, LuckyScore, StylistResult } from '@/types/archive'
