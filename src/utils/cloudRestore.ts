import {
  getArchives,
  saveArchive,
  getRawCurrentArchiveId,
  setCurrentArchiveId,
  getDailyResults,
  saveDailyResult,
} from '@/utils/archiveStorage'
import {
  syncAllArchivesToServer,
  fetchServerArchives,
  fetchServerCurrentArchiveId,
  fetchServerDailyResults,
} from '@/utils/serverSync'
import { isLoggedIn, isWeappEnv } from '@/utils/auth'
import type { Archive } from '@/types/archive'

export interface CloudRestoreStats {
  /** 从云端补回的档案数 */
  restoredArchives: number
  /** 从云端补回的每日运势缓存条数 */
  restoredDailyResults: number
  /** 是否采用了云端的当前选中档案 id */
  currentArchiveFixed: boolean
}

/**
 * 登录后的云端恢复（幂等，可反复调用）：
 * 1. 本地档案全量补传服务端（老用户首次迁移，fire-and-forget）
 * 2. 服务端档案合并回本地（只补本地缺失，不覆盖本地更新）
 * 3. 当前选中档案 id：本地从未设置过且云端有有效值时采用云端值
 *    （用户主动切换过——包括切到示例档案——则尊重本地选择）
 * 4. 服务端每日运势缓存合并回本地（只补本地缺失的 archiveId:date，不覆盖）
 *
 * 返回 null 表示未执行（非微信端/未登录）；返回统计对象表示已执行。
 */
export async function restoreFromCloud(): Promise<CloudRestoreStats | null> {
  if (!isWeappEnv() || !isLoggedIn()) return null
  const stats: CloudRestoreStats = { restoredArchives: 0, restoredDailyResults: 0, currentArchiveFixed: false }

  // 1. 本地 → 云端补传（老用户迁移；服务端 upsert 幂等）
  syncAllArchivesToServer(getArchives())

  // 2. 云端档案 → 本地补缺
  const serverProfiles = await fetchServerArchives()
  if (serverProfiles) {
    const now = Date.now()
    const localIds = new Set(getArchives().map(a => a.id))
    for (const p of serverProfiles) {
      if (localIds.has(p.id)) continue
      saveArchive({
        id: p.id,
        nickname: p.nickname || '未命名',
        gender: (p.gender === 'female' ? 'female' : 'male') as Archive['gender'],
        birthDate: p.birthDate || '',
        birthTime: p.birthTime || '',
        location: p.location || '',
        calendarType: (p.calendarType === 'lunar' ? 'lunar' : 'solar') as Archive['calendarType'],
        age: p.age ? parseInt(p.age, 10) || 0 : 0,
        stylePreference: p.stylePreference || '',
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      })
      stats.restoredArchives++
    }
  }

  // 3. 当前选中档案 id：仅当本地从未设置过（全新设备/重装）才采用云端值
  const serverCurrentId = await fetchServerCurrentArchiveId()
  if (serverCurrentId && !getRawCurrentArchiveId()) {
    const exists = getArchives().some(a => a.id === serverCurrentId)
    if (exists) {
      setCurrentArchiveId(serverCurrentId, { skipCloudSync: true })
      stats.currentArchiveFixed = true
    }
  }

  // 4. 云端每日运势缓存 → 本地补缺（key 为 archiveId:date，本地已有则不覆盖）
  const serverDaily = await fetchServerDailyResults()
  if (serverDaily) {
    const localMap = getDailyResults()
    for (const row of serverDaily) {
      if (!row?.archiveId || !row?.date || !row?.result) continue
      if (localMap[`${row.archiveId}:${row.date}`]) continue
      // result 即完整 DailyResult；以服务端行的 archiveId/date 为准校正后回写
      saveDailyResult(
        { ...row.result, archiveId: row.archiveId, date: row.date },
        { skipCloudSync: true },
      )
      stats.restoredDailyResults++
    }
  }

  if (stats.restoredArchives > 0 || stats.restoredDailyResults > 0 || stats.currentArchiveFixed) {
    console.log('[CloudRestore] 恢复完成:', stats)
  }
  return stats
}
