import { Network } from '@/network'
import { getToken, isWeappEnv } from '@/utils/auth'
import type { Archive } from '@/types/archive'
import type { HistoryRecord } from '@/types/bazi'

/**
 * 本地数据与服务端的双向同步（fire-and-forget 为主）。
 * 本地存储仍是主读取源；登录后档案/历史异步同步到服务端，实现：
 * - 保存：本地写库后异步双写（幂等 upsert，不会重复产生记录）
 * - 删除：本地删除后异步删除服务端对应记录
 * - 恢复：登录后从服务端拉取本地缺失的数据合并回来（跨设备/换机场景）
 */

const canSync = (): boolean => isWeappEnv() && !!getToken()

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
    .catch(e => console.warn('[Sync] archive sync failed:', e))
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
    .catch(e => console.warn('[Sync] all archives sync failed:', e))
}

/** 删除服务端档案（本地删除联动） */
export function deleteArchiveOnServer(archiveId: string): void {
  if (!canSync()) return
  Network.request({
    url: `/api/profile/${archiveId}`,
    method: 'DELETE',
    timeout: 10000,
  }).catch(e => console.warn('[Sync] archive delete failed:', e))
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
    .catch(e => console.warn('[Sync] history sync failed:', e))
}

/** 删除服务端历史记录（本地删除联动，clientId 为本地记录 id） */
export function deleteHistoryOnServer(clientId: string): void {
  if (!canSync()) return
  Network.request({
    url: `/api/history/client/${encodeURIComponent(clientId)}`,
    method: 'DELETE',
    timeout: 10000,
  }).catch(e => console.warn('[Sync] history delete failed:', e))
}

/** 清空服务端历史记录（本地清空联动） */
export function clearHistoryOnServer(): void {
  if (!canSync()) return
  Network.request({
    url: '/api/history',
    method: 'DELETE',
    timeout: 10000,
  }).catch(e => console.warn('[Sync] history clear failed:', e))
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
