import Taro from '@tarojs/taro'
import type { HistoryRecord } from '@/types/bazi'
import type { DailyResult, Archive } from '@/types/archive'

export type HistoryRecordItem = HistoryRecord

const OUTFIT_HISTORY_KEY = 'outfit_history'

export function buildHistoryRecord(
  dailyResult: DailyResult,
  archive?: Archive | null
): HistoryRecord {
  const bazi = dailyResult.baziResult
  return {
    ...bazi,
    id: `${dailyResult.archiveId}_${dailyResult.date}`,
    archiveId: dailyResult.archiveId,
    date: dailyResult.date,
    nickname: archive?.nickname || bazi.nickname || '',
    birthDate: archive?.birthDate || '',
    birthTime: archive?.birthTime || '',
    city: archive?.location || '',
    imageUrl: dailyResult.imageUrl || bazi.imageUrl,
    tryOnUrl: dailyResult.tryOnUrl,
    createdAt: Date.now(),
  }
}

export function saveHistoryFromDailyResult(
  dailyResult: DailyResult,
  archive?: Archive | null,
  patch?: { imageUrl?: string; tryOnUrl?: string }
) {
  const record = buildHistoryRecord(dailyResult, archive)
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
  const index = records.findIndex(
    r => r.archiveId === record.archiveId && r.date === record.date
  )
  if (index >= 0) {
    records[index] = { ...records[index], ...record }
  } else {
    records.unshift(record)
  }
  saveHistoryRecords(records)
}

export function updateHistoryImage(params: {
  archiveId: string
  date: string
  imageUrl?: string
  tryOnUrl?: string
}) {
  const records = getHistoryRecords()
  const index = records.findIndex(
    r => r.archiveId === params.archiveId && r.date === params.date
  )
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
