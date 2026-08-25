import { Network } from '@/network'
import { getToken, isWeappEnv } from '@/utils/auth'
import type { Archive, DailyResult } from '@/types/archive'
import type { HistoryRecord } from '@/types/bazi'

/**
 * 本地数据与服务端的双向同步（fire-and-forget 为主）。
 * 本地存储仍是主读取源；登录后档案/历史异步同步到服务端，实现：
 * - 保存：本地写库后异步双写（幂等 upsert，不会重复产生记录）
 * - 删除：本地删除后异步删除服务端对应记录
 * - 恢复：登录后从服务端拉取本地缺失的数据合并回来（跨设备/换机场景）
 */

const canSync = (): boolean => isWeappEnv() && !!getToken()

/**
 * 同步失败上报：写入服务端客户端日志，便于发现「数据静默丢失」问题。
 * fire-and-forget：上报本身失败不再重试/再上报，避免递归；跳过 401 自动重试（同步场景下重试意义不大）。
 */
function reportSyncFailure(action: string, err: unknown): void {
  Network.request({
    url: '/api/log/client',
    method: 'POST',
    data: {
      level: 'warn',
      tag: 'server-sync',
      message: `${action} failed: ${err instanceof Error ? err.message : String(err)}`,
    },
    timeout: 5000,
    _skipAuthRetry: true,
  } as Parameters<typeof Network.request>[0]).catch(() => {
    /* 上报失败则放弃，避免递归 */
  })
}

// ==================== 档案同步 ====================

const toProfilePayload = (archive: Archive) => ({
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
})

/** 同步单个档案到服务端（幂等 upsert，key 为本地档案 id） */
export function syncArchiveToServer(archive: Archive): void {
  if (!canSync() || archive.isDefault) return
  Network.request({
    url: '/api/profile/sync',
    method: 'POST',
    data: { profiles: [toProfilePayload(archive)] },
    timeout: 10000,
  })
    .then(res => {
      console.log('[Sync] archive synced:', res.data?.data?.total ?? 0)
    })
    .catch(e => {
      console.warn('[Sync] archive sync failed:', e)
      reportSyncFailure('archive sync', e)
    })
}

/** 全量同步本地档案到服务端（老用户首次登录后调用） */
export function syncAllArchivesToServer(archives: Archive[]): void {
  const list = archives.filter(a => !a.isDefault).map(toProfilePayload)
  if (!canSync() || list.length === 0) return
  Network.request({
    url: '/api/profile/sync',
    method: 'POST',
    data: { profiles: list },
    timeout: 15000,
  })
    .then(res => {
      console.log('[Sync] all archives synced:', res.data?.data?.total ?? 0)
    })
    .catch(e => {
      console.warn('[Sync] all archives sync failed:', e)
      reportSyncFailure('all archives sync', e)
    })
}

/** 删除服务端档案（本地删除联动） */
export function deleteArchiveOnServer(archiveId: string): void {
  if (!canSync()) return
  Network.request({
    url: `/api/profile/${archiveId}`,
    method: 'DELETE',
    timeout: 10000,
  }).catch(e => {
    console.warn('[Sync] archive delete failed:', e)
    reportSyncFailure('archive delete', e)
  })
}

export interface ServerProfile {
  id: string
  nickname: string
  gender: string
  birthDate: string
  birthTime: string
  location: string
  calendarType: string
  stylePreference: string
  age: string | null
  isDefault: boolean
}

/** 拉取服务端档案列表（云端恢复用），失败返回 null */
export async function fetchServerArchives(): Promise<ServerProfile[] | null> {
  if (!canSync()) return null
  try {
    const res = await Network.request({ url: '/api/profile/list', method: 'GET', timeout: 10000 })
    if (res.statusCode === 200 && Array.isArray(res.data?.data)) {
      return res.data.data as ServerProfile[]
    }
    return null
  } catch (e) {
    console.warn('[Sync] fetch archives failed:', e)
    reportSyncFailure('fetch archives', e)
    return null
  }
}

// ==================== 历史记录同步 ====================

/** 同步一条历史记录到服务端（幂等：clientId 为本地记录 id，重复调用执行更新） */
export function syncHistoryToServer(record: HistoryRecord): void {
  if (!canSync()) return
  Network.request({
    url: '/api/history/save',
    method: 'POST',
    data: {
      clientId: record.id,
      profileId: record.archiveId,
      type: record.mode || 'daily',
      nickname: record.nickname || '',
      gender: record.gender || '',
      // 存完整记录 JSON，云端恢复时可直接重建本地记录渲染详情
      result: JSON.stringify(record),
      imageUrl: record.imageUrl,
      tryOnUrl: record.tryOnUrl,
      llmPlan: record.llmPlan ? JSON.stringify(record.llmPlan) : undefined,
    },
    timeout: 10000,
  })
    .then(res => {
      console.log('[Sync] history synced:', res.data?.data?.id, 'updated:', res.data?.data?.updated)
    })
    .catch(e => {
      console.warn('[Sync] history sync failed:', e)
      reportSyncFailure('history sync', e)
    })
}

/** 删除服务端历史记录（本地删除联动，clientId 为本地记录 id） */
export function deleteHistoryOnServer(clientId: string): void {
  if (!canSync()) return
  Network.request({
    url: `/api/history/client/${encodeURIComponent(clientId)}`,
    method: 'DELETE',
    timeout: 10000,
  }).catch(e => {
    console.warn('[Sync] history delete failed:', e)
    reportSyncFailure('history delete', e)
  })
}

/** 清空服务端历史记录（本地清空联动） */
export function clearHistoryOnServer(): void {
  if (!canSync()) return
  Network.request({
    url: '/api/history',
    method: 'DELETE',
    timeout: 10000,
  }).catch(e => {
    console.warn('[Sync] history clear failed:', e)
    reportSyncFailure('history clear', e)
  })
}

export interface ServerHistoryRecord {
  id: string
  clientId: string | null
  profileId: string | null
  type: string
  nickname: string
  gender: string
  /** 完整 HistoryRecord 的 JSON 字符串 */
  result: string
  imageUrl: string | null
  tryOnUrl: string | null
  createdAt: number
}

/** 拉取服务端历史记录（云端恢复用），失败返回 null */
export async function fetchServerHistory(pageSize = 50): Promise<ServerHistoryRecord[] | null> {
  if (!canSync()) return null
  try {
    const res = await Network.request({
      url: `/api/history/list?page=1&pageSize=${pageSize}`,
      method: 'GET',
      timeout: 10000,
    })
    if (res.statusCode === 200 && Array.isArray(res.data?.data?.list)) {
      return res.data.data.list as ServerHistoryRecord[]
    }
    return null
  } catch (e) {
    console.warn('[Sync] fetch history failed:', e)
    reportSyncFailure('fetch history', e)
    return null
  }
}

/** 把服务端历史记录还原为本地 HistoryRecord（无法解析时返回 null） */
export function parseServerHistoryRecord(row: ServerHistoryRecord): HistoryRecord | null {
  if (!row.clientId || !row.result) return null
  try {
    const record = JSON.parse(row.result) as HistoryRecord
    if (!record.id || !record.archiveId) return null
    // 服务端图片 URL 可能比本地新（补丁更新），优先使用服务端值
    if (row.imageUrl) record.imageUrl = row.imageUrl
    if (row.tryOnUrl) record.tryOnUrl = row.tryOnUrl
    return record
  } catch {
    return null
  }
}

// ==================== 当前选中档案 id 同步 ====================

/** 同步当前选中档案 id 到服务端（fire-and-forget，对应 setCurrentArchiveId/revertToArchiveId） */
export function syncCurrentArchiveIdToServer(archiveId: string): void {
  if (!canSync()) return
  Network.request({
    url: '/api/profile/current-archive',
    method: 'PUT',
    data: { archiveId },
    timeout: 10000,
  }).catch(e => {
    console.warn('[Sync] current archive id sync failed:', e)
    reportSyncFailure('current archive id sync', e)
  })
}

/** 拉取服务端当前选中档案 id（未设置/失败均返回 null，调用方自行区分） */
export async function fetchServerCurrentArchiveId(): Promise<string | null> {
  if (!canSync()) return null
  try {
    const res = await Network.request({ url: '/api/profile/current-archive', method: 'GET', timeout: 10000 })
    if (res.statusCode === 200) {
      const id = res.data?.data?.archiveId
      return typeof id === 'string' && id ? id : null
    }
    return null
  } catch (e) {
    console.warn('[Sync] fetch current archive id failed:', e)
    reportSyncFailure('fetch current archive id', e)
    return null
  }
}

// ==================== 每日运势缓存同步（DAILY_RESULTS_KEY） ====================

/** 同步一条每日运势缓存到服务端（fire-and-forget，幂等 upsert） */
export function syncDailyResultToServer(result: DailyResult): void {
  if (!canSync() || !result?.archiveId || !result?.date) return
  Network.request({
    url: '/api/daily-results/save',
    method: 'POST',
    data: { archiveId: result.archiveId, date: result.date, result },
    timeout: 10000,
  }).catch(e => {
    console.warn('[Sync] daily result sync failed:', e)
    reportSyncFailure('daily result sync', e)
  })
}

/** 删除服务端某档案下全部每日缓存（对应 clearDailyResultsByArchive） */
export function deleteDailyResultsByArchiveOnServer(archiveId: string): void {
  if (!canSync()) return
  Network.request({
    url: `/api/daily-results/archive/${encodeURIComponent(archiveId)}`,
    method: 'DELETE',
    timeout: 10000,
  }).catch(e => {
    console.warn('[Sync] daily results delete by archive failed:', e)
    reportSyncFailure('daily results delete by archive', e)
  })
}

/** 删除服务端单条每日缓存（对应 clearDailyResult） */
export function deleteDailyResultOnServer(archiveId: string, date: string): void {
  if (!canSync()) return
  Network.request({
    url: `/api/daily-results/${encodeURIComponent(archiveId)}/${encodeURIComponent(date)}`,
    method: 'DELETE',
    timeout: 10000,
  }).catch(e => {
    console.warn('[Sync] daily result delete failed:', e)
    reportSyncFailure('daily result delete', e)
  })
}

export interface ServerDailyResult {
  id: string
  archiveId: string
  date: string
  /** 完整 DailyResult 对象 */
  result: DailyResult
  updatedAt: number
}

/** 拉取服务端每日运势缓存（云端恢复用），失败返回 null */
export async function fetchServerDailyResults(): Promise<ServerDailyResult[] | null> {
  if (!canSync()) return null
  try {
    const res = await Network.request({ url: '/api/daily-results/list', method: 'GET', timeout: 15000 })
    if (res.statusCode === 200 && Array.isArray(res.data?.data)) {
      return res.data.data as ServerDailyResult[]
    }
    return null
  } catch (e) {
    console.warn('[Sync] fetch daily results failed:', e)
    reportSyncFailure('fetch daily results', e)
    return null
  }
}
