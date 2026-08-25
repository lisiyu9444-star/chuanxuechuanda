import Taro from '@tarojs/taro'
import type { HistoryRecord } from '@/types/bazi'
import type { DailyResult, NativeResult, Archive } from '@/types/archive'
import { extractTosKeyFromUrl } from '@/constants/remote-assets'

export type HistoryRecordItem = HistoryRecord

const OUTFIT_HISTORY_KEY = 'outfit_history'
// 单 key storage 上限 1MB（微信）：限制最大条数，超出淘汰最旧（数组头部为最新）
const MAX_HISTORY_RECORDS = 100

export function buildHistoryRecord(
  result: DailyResult | NativeResult,
  archive?: Archive | null,
  mode: 'daily' | 'native' = 'daily'
): HistoryRecord {
  const bazi = result.baziResult
  const isNative = mode === 'native'
  const id = isNative ? `${result.archiveId}_native` : `${result.archiveId}_${(result as DailyResult).date}`
  return {
    ...bazi,
    id,
    archiveId: result.archiveId,
    date: isNative ? undefined : (result as DailyResult).date,
    mode,
    nickname: archive?.nickname || bazi.nickname || '',
    birthDate: archive?.birthDate || '',
    birthTime: archive?.birthTime || '',
    city: archive?.location || '',
    imageUrl: (result as DailyResult).imageUrl || bazi.imageUrl,
    tryOnUrl: (result as DailyResult).tryOnUrl,
    imageKey: result.imageKey,
    tryOnKey: result.tryOnKey,
    llmPlan: (result as DailyResult).llmPlan || bazi.llmPlan,
    createdAt: Date.now(),
  }
}

export interface HistoryImagePatch {
  imageUrl?: string
  tryOnUrl?: string
  imageKey?: string
  tryOnKey?: string
}

function applyImagePatch(record: HistoryRecord, patch?: HistoryImagePatch) {
  if (patch?.imageUrl) record.imageUrl = patch.imageUrl
  if (patch?.tryOnUrl) record.tryOnUrl = patch.tryOnUrl
  if (patch?.imageKey) record.imageKey = patch.imageKey
  if (patch?.tryOnKey) record.tryOnKey = patch.tryOnKey
}

export function saveHistoryFromDailyResult(
  dailyResult: DailyResult,
  archive?: Archive | null,
  patch?: HistoryImagePatch
) {
  const record = buildHistoryRecord(dailyResult, archive, 'daily')
  applyImagePatch(record, patch)
  saveHistoryRecord(record)
}

export function saveHistoryFromNativeResult(
  nativeResult: NativeResult,
  archive?: Archive | null,
  patch?: HistoryImagePatch
) {
  const record = buildHistoryRecord(nativeResult, archive, 'native')
  applyImagePatch(record, patch)
  saveHistoryRecord(record)
}

export function getHistoryRecords(): HistoryRecord[] {
  try {
    const data = Taro.getStorageSync(OUTFIT_HISTORY_KEY)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function saveHistoryRecords(records: HistoryRecord[]) {
  // 容量保护：先按条数上限裁剪；写入仍失败（单条过大/总容量不足）时逐轮淘汰最旧 10 条重试，
  // 保证「最新记录一定能写入」，避免 setStorageSync 超限异常被静默吞掉导致新记录丢失
  let list = records.length > MAX_HISTORY_RECORDS ? records.slice(0, MAX_HISTORY_RECORDS) : records
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      Taro.setStorageSync(OUTFIT_HISTORY_KEY, list)
      return
    } catch (e) {
      console.error(`[History] save failed (attempt ${attempt + 1}, ${list.length} records):`, e)
      if (list.length <= 10) break
      list = list.slice(0, list.length - 10)
    }
  }
  console.error('[History] save failed permanently after eviction retries')
}

export function saveHistoryRecord(record: HistoryRecord) {
  const records = getHistoryRecords()
  const index = records.findIndex(r => r.id === record.id)
  if (index >= 0) {
    // 合并时忽略 undefined 字段，防止由陈旧快照重建的 record 把已保存的
    // 图片字段（imageUrl/tryOnUrl/imageKey/tryOnKey）覆盖为 undefined
    const merged: Record<string, unknown> = { ...records[index] }
    for (const [key, value] of Object.entries(record)) {
      if (value !== undefined) merged[key] = value
    }
    records[index] = merged as unknown as HistoryRecord
  } else {
    records.unshift(record)
  }
  saveHistoryRecords(records)
}

export function updateHistoryImage(params: {
  archiveId: string
  mode: 'daily' | 'native'
  date?: string
  imageUrl?: string
  tryOnUrl?: string
  imageKey?: string
  tryOnKey?: string
}) {
  const records = getHistoryRecords()
  const targetId = params.mode === 'native'
    ? `${params.archiveId}_native`
    : `${params.archiveId}_${params.date}`
  const index = records.findIndex(r => r.id === targetId)
  if (index >= 0) {
    if (params.imageUrl) records[index].imageUrl = params.imageUrl
    if (params.tryOnUrl) records[index].tryOnUrl = params.tryOnUrl
    if (params.imageKey) records[index].imageKey = params.imageKey
    if (params.tryOnKey) records[index].tryOnKey = params.tryOnKey
    saveHistoryRecords(records)
  }
}

/**
 * 批量回写换签后的图片 URL（key -> 新 URL）。
 * 同时刷新记录的 imageUrl/tryOnUrl 字段，保持展示与缓存一致。
 */
export function refreshHistoryImageUrls(urlMap: Record<string, string>): HistoryRecord[] {
  const records = getHistoryRecords()
  let changed = false
  for (const record of records) {
    // 旧记录无 key 时从 URL 兜底提取并回写，完成一次性迁移
    if (!record.imageKey && record.imageUrl) {
      const key = extractTosKeyFromUrl(record.imageUrl)
      if (key) record.imageKey = key
    }
    if (!record.tryOnKey && record.tryOnUrl) {
      const key = extractTosKeyFromUrl(record.tryOnUrl)
      if (key) record.tryOnKey = key
    }
    if (record.imageKey && urlMap[record.imageKey]) {
      record.imageUrl = urlMap[record.imageKey]
      changed = true
    }
    if (record.tryOnKey && urlMap[record.tryOnKey]) {
      record.tryOnUrl = urlMap[record.tryOnKey]
      changed = true
    }
  }
  if (changed) saveHistoryRecords(records)
  return records
}

export function deleteHistoryRecord(id: string) {
  const records = getHistoryRecords()
  const filtered = records.filter(r => r.id !== id)
  saveHistoryRecords(filtered)
}

export function clearHistoryRecords() {
  saveHistoryRecords([])
}
