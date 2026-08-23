import Taro from '@tarojs/taro'
import type { Archive, DailyResult, NativeResult, ImageUnlockState } from '@/types/archive'
import { normalizeLuckyScore } from '@/types/archive'

const ARCHIVES_KEY = 'outfit_archives'
const CURRENT_ARCHIVE_ID_KEY = 'current_archive_id'
// 切换前的档案 id：loading 取消生成时回退用（一次性消费语义）
const PREVIOUS_ARCHIVE_ID_KEY = 'previous_archive_id'
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
  const current = getCurrentArchiveId()
  // 真实切换时记录旧档案，供「取消生成」场景回退（一次性消费，见 loading 页 useDidShow）
  if (current && current !== id) {
    safeSet(PREVIOUS_ARCHIVE_ID_KEY, current)
  }
  safeSet(CURRENT_ARCHIVE_ID_KEY, id)
}

// 读取并清除切换前的档案 id（一次性消费）。loading 页进入时快照，用户取消生成时据此回退；
// 首页在切换已生效（展示缓存/示例/冷却态）时也会消费，避免过期残留导致误回退
export function consumePreviousArchiveId(): string {
  const prev = safeGet<string>(PREVIOUS_ARCHIVE_ID_KEY, '')
  if (prev) {
    try {
      Taro.removeStorageSync(PREVIOUS_ARCHIVE_ID_KEY)
    } catch {
      /* noop */
    }
  }
  return prev
}

// 取消生成时回退到指定档案。必须直写存储：走 setCurrentArchiveId 会把被取消的档案再次记入 previous
export function revertToArchiveId(id: string): boolean {
  if (!id || id === getCurrentArchiveId()) return false
  if (!getArchiveById(id)) return false
  safeSet(CURRENT_ARCHIVE_ID_KEY, id)
  return true
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
  const result = getDailyResults()[getDailyResultKey(archiveId, date)]
  if (!result?.luckyScore) return result
  // 历史缓存可能为旧字段（love/family/life/study），统一归一化为展示五维
  return { ...result, luckyScore: normalizeLuckyScore(result.luckyScore) }
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

export function clearDailyResultsByArchive(archiveId: string): void {
  const map = getDailyResults()
  Object.keys(map).forEach((key) => {
    if (key.startsWith(`${archiveId}:`)) {
      delete map[key]
    }
  })
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

// 今日穿搭生成中断冷却标记：loading 页失败/被用户取消回首页后，首页 onShow 会再次自动跳转 loading，
// 无标记会形成「中断 → 回首页 → 自动再进 → 再中断」死循环。冷却期内首页改为静态卡片，由用户手动重试。
// 标记区分来源：用户主动取消（cancelled）首页展示正常空态；真实失败展示失败重试卡片。
const DAILY_FAIL_KEY = 'daily_generate_failures'
const DAILY_FAIL_COOLDOWN_MS = 30 * 60 * 1000 // 30 分钟

// 兼容旧数据：number 时间戳视为失败标记；对象形式可携带 cancelled 区分用户主动取消
type DailyFailEntry = { ts: number; cancelled?: boolean }
type DailyFailMap = Record<string, number | DailyFailEntry>

const getDailyFailKey = (archiveId: string, date: string) => `${archiveId}_${date}`

export function markDailyGenerateFailed(archiveId: string, date: string = getToday()): void {
  const map = safeGet<DailyFailMap>(DAILY_FAIL_KEY, {})
  map[getDailyFailKey(archiveId, date)] = Date.now()
  safeSet(DAILY_FAIL_KEY, map)
}

export function markDailyGenerateCancelled(archiveId: string, date: string = getToday()): void {
  const map = safeGet<DailyFailMap>(DAILY_FAIL_KEY, {})
  map[getDailyFailKey(archiveId, date)] = { ts: Date.now(), cancelled: true }
  safeSet(DAILY_FAIL_KEY, map)
}

export function clearDailyGenerateFailed(archiveId: string, date: string = getToday()): void {
  const map = safeGet<DailyFailMap>(DAILY_FAIL_KEY, {})
  const key = getDailyFailKey(archiveId, date)
  if (key in map) {
    delete map[key]
    safeSet(DAILY_FAIL_KEY, map)
  }
}

export function isDailyGenerateCoolingDown(archiveId: string, date: string = getToday()): boolean {
  const map = safeGet<DailyFailMap>(DAILY_FAIL_KEY, {})
  const entry = map[getDailyFailKey(archiveId, date)]
  if (!entry) return false
  const ts = typeof entry === 'number' ? entry : entry.ts
  return Date.now() - ts <= DAILY_FAIL_COOLDOWN_MS
}

// 最近一次中断是否为用户主动取消（需在冷却期内）
export function isDailyGenerateCancelled(archiveId: string, date: string = getToday()): boolean {
  const map = safeGet<DailyFailMap>(DAILY_FAIL_KEY, {})
  const entry = map[getDailyFailKey(archiveId, date)]
  if (!entry || typeof entry === 'number' || !entry.cancelled) return false
  return Date.now() - entry.ts <= DAILY_FAIL_COOLDOWN_MS
}

export function clearAllStorage(): void {
  try {
    Taro.removeStorageSync(ARCHIVES_KEY)
    Taro.removeStorageSync(CURRENT_ARCHIVE_ID_KEY)
    Taro.removeStorageSync(DAILY_RESULTS_KEY)
    Taro.removeStorageSync(NATIVE_RESULTS_KEY)
    Taro.removeStorageSync(IMAGE_UNLOCKS_KEY)
    Taro.removeStorageSync(DAILY_FAIL_KEY)
  } catch (e) {
    console.error('[archiveStorage] clear failed', e)
  }
}

export type { Archive, DailyResult, NativeResult, ImageUnlockState, LuckyScore, StylistResult } from '@/types/archive'
