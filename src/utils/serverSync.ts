import { Network } from '@/network'
import { getToken, isWeappEnv } from '@/utils/auth'
import type { Archive } from '@/types/archive'
import type { HistoryRecord } from '@/types/bazi'

/**
 * 本地数据到服务端的轻量双写（fire-and-forget）。
 * 本地存储仍是主读取源；登录后将档案/历史异步同步到服务端，
 * 失败静默忽略（本地数据完整，不影响使用），为后续云端恢复打底。
 */

const canSync = (): boolean => isWeappEnv() && !!getToken()

/** 同步单个档案到服务端（幂等 upsert，key 为本地档案 id） */
export function syncArchiveToServer(archive: Archive): void {
  if (!canSync() || archive.isDefault) return
  Network.request({
    url: '/api/profile/sync',
    method: 'POST',
    data: {
      profiles: [
        {
          id: archive.id,
          nickname: archive.nickname,
          gender: archive.gender,
          birthDate: archive.birthDate,
          birthTime: archive.birthTime,
          location: archive.location,
          calendarType: archive.calendarType,
          stylePreference: archive.stylePreference || '',
          age: archive.age !== undefined && archive.age !== null ? String(archive.age) : undefined,
          isDefault: false,
        },
      ],
    },
    timeout: 10000,
  })
    .then(res => {
      console.log('[Sync] archive synced:', res.data?.data?.total ?? 0)
    })
    .catch(e => console.warn('[Sync] archive sync failed:', e))
}

/** 同步一条历史记录到服务端 */
export function syncHistoryToServer(record: HistoryRecord): void {
  if (!canSync()) return
  Network.request({
    url: '/api/history/save',
    method: 'POST',
    data: {
      profileId: record.archiveId,
      type: record.mode || 'daily',
      nickname: record.nickname || '',
      gender: record.gender || '',
      result: JSON.stringify({
        dayMaster: record.dayMaster,
        dayMasterElement: record.dayMasterElement,
        favorableElement: record.favorableElement,
        favorableAnalysis: record.favorableAnalysis,
        outfit: record.outfit,
        ganZhiDate: record.ganZhiDate,
        dailyYongShen: record.dailyYongShen,
        dailyXiShen: record.dailyXiShen,
        date: record.date,
      }),
      imageUrl: record.imageUrl,
      tryOnUrl: record.tryOnUrl,
      llmPlan: record.llmPlan ? JSON.stringify(record.llmPlan) : undefined,
    },
    timeout: 10000,
  })
    .then(res => {
      console.log('[Sync] history synced:', res.data?.data?.id)
    })
    .catch(e => console.warn('[Sync] history sync failed:', e))
}
