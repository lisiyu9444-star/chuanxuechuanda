import Taro from '@tarojs/taro'
import type { HistoryRecord } from '@/types/bazi'
import type { DailyResult, NativeResult, Archive } from '@/types/archive'

export type HistoryRecordItem = HistoryRecord

const OUTFIT_HISTORY_KEY = 'outfit_history'

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
    createdAt: Date.now(),
  }
}

export function saveHistoryFromDailyResult(
  dailyResult: DailyResult,
  archive?: Archive | null,
  patch?: { imageUrl?: string; tryOnUrl?: string }
) {
  const record = buildHistoryRecord(dailyResult, archive, 'daily')
  if (patch?.imageUrl) record.imageUrl = patch.imageUrl
  if (patch?.tryOnUrl) record.tryOnUrl = patch.tryOnUrl
  saveHistoryRecord(record)
}

export function saveHistoryFromNativeResult(
  nativeResult: NativeResult,
  archive?: Archive | null,
  patch?: { imageUrl?: string; tryOnUrl?: string }
) {
  const record = buildHistoryRecord(nativeResult, archive, 'native')
  if (patch?.imageUrl) record.imageUrl = patch.imageUrl
  if (patch?.tryOnUrl) record.tryOnUrl = patch.tryOnUrl
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
  try {
    Taro.setStorageSync(OUTFIT_HISTORY_KEY, records)
  } catch (e) {
    console.error('save history records failed', e)
  }
}

export function saveHistoryRecord(record: HistoryRecord) {
  const records = getHistoryRecords()
  const index = records.findIndex(r => r.id === record.id)
  if (index >= 0) {
    records[index] = { ...records[index], ...record }
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
}) {
  const records = getHistoryRecords()
  const targetId = params.mode === 'native'
    ? `${params.archiveId}_native`
    : `${params.archiveId}_${params.date}`
  const index = records.findIndex(r => r.id === targetId)
  if (index >= 0) {
    if (params.imageUrl) records[index].imageUrl = params.imageUrl
    if (params.tryOnUrl) records[index].tryOnUrl = params.tryOnUrl
    saveHistoryRecords(records)
  }
}

export function deleteHistoryRecord(id: string) {
  const records = getHistoryRecords()
  const filtered = records.filter(r => r.id !== id)
  saveHistoryRecords(filtered)
}

export function clearHistoryRecords() {
  saveHistoryRecords([])
}
