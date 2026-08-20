import { useCallback, useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { Network } from '@/network'

interface RewardedVideoAdInstance {
  load: () => Promise<any>
  show: () => Promise<any>
  onLoad: (fn: () => void) => void
  offLoad: (fn: () => void) => void
  onError: (fn: (err: any) => void) => void
  offError: (fn: (err: any) => void) => void
  onClose: (fn: (res: { isEnded: boolean }) => void) => void
  offClose: (fn: (res: { isEnded: boolean }) => void) => void
  destroy: () => void
}

export interface AdErrorInfo {
  errCode?: number | string
  errMsg?: string
}

export interface ShowAdResult {
  /** 用户是否完整观看 */
  watched: boolean
  /**
   * 广告加载/展示失败时的错误信息。
   * undefined 表示广告曾正常展示、但用户提前关闭（未完整观看）。
   */
  error?: AdErrorInfo
}

interface UseRewardedVideoAdOptions {
  /** 广告单元 ID */
  adUnitId: string
  /** 广告加载/播放错误回调 */
  onError?: (err: any) => void
}

interface UseRewardedVideoAdReturn {
  /** 展示广告，返回观看结果（含失败原因，便于区分"广告不可用"与"未完整观看"） */
  showAd: () => Promise<ShowAdResult>
  /** 广告是否已加载就绪 */
  isReady: boolean
  /** 最后一次错误信息 */
  error: any
}

/**
 * 广告实例全局单例缓存（微信官方推荐做法）。
 * 反复 createRewardedVideoAd + destroy 会导致 SDK 内部原生组件清理竞态，
 * 产生 removeVideoPlayer:fail / removeTextView:fail no root 等无法捕获的红色报错。
 * 单例复用后实例生命周期与小程序一致，可显著降低这类噪音错误。
 * 仅当确认实例损坏（load/show 最终失败）时才销毁重建，实现自愈。
 */
const adInstanceCache = new Map<string, RewardedVideoAdInstance>()
const adPreloadedSet = new Set<string>()

/** 归一化广告 SDK 错误对象，提取 errCode / errMsg */
function normalizeAdError(err: any): AdErrorInfo {
  if (!err) return {}
  if (typeof err === 'string') return { errMsg: err }
  const info: AdErrorInfo = {
    errCode: err.errCode ?? err.code ?? err.err_no ?? err.errNo,
    errMsg: err.errMsg ?? err.message,
  }
  if (!info.errCode && !info.errMsg) {
    try {
      info.errMsg = JSON.stringify(err)
    } catch {
      info.errMsg = String(err)
    }
  }
  return info
}

/**
 * 广告问题双通道上报（fire-and-forget，绝不阻塞业务流程）：
 * 1. 微信实时日志：小程序后台「管理 → 运维中心 → 实时日志」可查，正式版可用
 * 2. 自建服务端日志：写入线上运行日志，便于远程诊断
 */
function reportAdIssue(event: string, adUnitId: string, err: any) {
  const errInfo = normalizeAdError(err)
  try {
    const getManager = (Taro as any).getRealtimeLogManager
    if (typeof getManager === 'function') {
      const logger = getManager.call(Taro)
      logger?.error?.(`[rewarded-ad] ${event}`, { adUnitId, ...errInfo })
    }
  } catch {
    // 实时日志不可用时忽略
  }
  try {
    Network.request({
      url: '/api/log/client',
      method: 'POST',
      data: {
        tag: 'rewarded-ad',
        level: 'error',
        message: event,
        extra: { adUnitId, ...errInfo, env: Taro.getEnv() },
      },
    }).catch(() => {
      // 上报失败忽略
    })
  } catch {
    // 上报不可用忽略
  }
}

function getOrCreateAd(adUnitId: string): RewardedVideoAdInstance | null {
  const cached = adInstanceCache.get(adUnitId)
  if (cached) return cached
  if (typeof Taro.createRewardedVideoAd !== 'function') return null
  try {
    const ad = Taro.createRewardedVideoAd({ adUnitId }) as RewardedVideoAdInstance
    adInstanceCache.set(adUnitId, ad)
    return ad
  } catch (e) {
    console.warn('[useRewardedVideoAd] create failed', e)
    return null
  }
}

/** 销毁损坏实例并移出缓存，下次使用时自动重建（自愈） */
function destroyAd(adUnitId: string) {
  const ad = adInstanceCache.get(adUnitId)
  adInstanceCache.delete(adUnitId)
  adPreloadedSet.delete(adUnitId)
  if (ad) {
    try {
      ad.destroy()
    } catch {
      // destroy 异常忽略
    }
  }
}

/** 预加载仅在实例创建后执行一次；失败时移除标记，允许后续重试 */
function preloadOnce(adUnitId: string, ad: RewardedVideoAdInstance) {
  if (adPreloadedSet.has(adUnitId)) return
  adPreloadedSet.add(adUnitId)
  try {
    ad.load().catch((err: any) => {
      // 预加载失败：移除标记允许重试；SDK 内部竞态（如 e.adProxy 未就绪）会自动恢复，仅提示
      adPreloadedSet.delete(adUnitId)
      console.warn('[useRewardedVideoAd] preload failed (will retry later)', err)
    })
  } catch (e) {
    adPreloadedSet.delete(adUnitId)
    console.warn('[useRewardedVideoAd] preload sync error', e)
  }
}

/**
 * 微信小程序激励视频广告 Hook
 *
 * 功能：
 * - 仅在微信小程序环境初始化
 * - 广告实例全局单例复用，页面加载时预加载
 * - showAd 返回 ShowAdResult，可区分"广告加载/展示失败"与"用户未完整观看"
 * - 失败自动双通道上报（微信实时日志 + 服务端日志），并销毁坏实例实现自愈
 * - H5 / 抖音小程序等非微信环境直接返回 watched: false，由业务方决定是否放行
 *
 * @example
 * ```tsx
 * const { showAd } = useRewardedVideoAd({ adUnitId: 'adunit-xxx' })
 *
 * const handleUnlock = async () => {
 *   if (Taro.getEnv() === Taro.ENV_TYPE.WEAPP) {
 *     const { watched, error } = await showAd()
 *     if (!watched) {
 *       Taro.showToast({
 *         title: error ? '广告加载失败，请稍后重试' : '请完整观看视频以解锁',
 *         icon: 'none',
 *       })
 *       return
 *     }
 *   }
 *   // 执行解锁后的逻辑
 * }
 * ```
 */
export function useRewardedVideoAd(options: UseRewardedVideoAdOptions): UseRewardedVideoAdReturn {
  const { adUnitId, onError } = options
  const adRef = useRef<RewardedVideoAdInstance | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<any>(null)

  const isWeapp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP

  // 微信开发者工具中广告 SDK 内部对象 adProxy 不存在，调用 load/show 会导致 SDK 内部崩溃，
  // 且会产生 removeVideoPlayer / predownload 等无法捕获的全局异常，因此直接跳过初始化
  const isDevtools = (() => {
    if (!isWeapp) return false
    try {
      return Taro.getSystemInfoSync().platform === 'devtools'
    } catch {
      return false
    }
  })()

  useEffect(() => {
    if (!isWeapp || isDevtools) return

    const ad = getOrCreateAd(adUnitId)
    if (!ad) {
      console.warn('[useRewardedVideoAd] createRewardedVideoAd not available')
      return
    }
    adRef.current = ad

    const handleLoad = () => {
      console.log('[useRewardedVideoAd] loaded')
      setIsReady(true)
      setError(null)
    }

    const handleError = (err: any) => {
      console.error('[useRewardedVideoAd] error', err)
      setIsReady(false)
      setError(err)
      reportAdIssue('load-error', adUnitId, err)
      onError?.(err)
    }

    const handleClose = (res: { isEnded: boolean }) => {
      console.log('[useRewardedVideoAd] close', res)
    }

    ad.onLoad(handleLoad)
    ad.onError(handleError)
    ad.onClose(handleClose)

    // 预加载广告，提升展示成功率（每个实例仅执行一次，失败可重试）
    preloadOnce(adUnitId, ad)

    return () => {
      // 仅摘除本组件的事件监听，不 destroy 实例（单例复用，避免 SDK 原生组件清理竞态）
      ad.offLoad(handleLoad)
      ad.offError(handleError)
      ad.offClose(handleClose)
      adRef.current = null
    }
  }, [adUnitId, isWeapp, isDevtools, onError])

  const showAd = useCallback((): Promise<ShowAdResult> => {
    return new Promise((resolve) => {
      // 开发者工具中广告 SDK 不可用，直接视为已完整观看，方便开发调试
      if (isDevtools) {
        resolve({ watched: true })
        return
      }
      if (!isWeapp) {
        resolve({ watched: false })
        return
      }

      // 实例可能因上次失败被销毁，此处现场重建（自愈）
      if (!adRef.current) {
        adRef.current = getOrCreateAd(adUnitId)
        if (adRef.current) {
          preloadOnce(adUnitId, adRef.current)
        }
      }
      const ad = adRef.current
      if (!ad) {
        reportAdIssue('instance-unavailable', adUnitId, null)
        resolve({ watched: false, error: { errMsg: 'ad instance unavailable' } })
        return
      }

      let closeHandler: ((res: { isEnded: boolean }) => void) | null = null
      let settled = false

      const cleanup = () => {
        if (closeHandler) {
          ad.offClose(closeHandler)
        }
      }

      const settleFail = (err: any, stage: string) => {
        if (settled) return
        settled = true
        cleanup()
        reportAdIssue(`show-failed:${stage}`, adUnitId, err)
        // 自愈：销毁可能已损坏的实例，下次点击时重建
        destroyAd(adUnitId)
        adRef.current = null
        resolve({ watched: false, error: normalizeAdError(err) })
      }

      closeHandler = (res: { isEnded: boolean }) => {
        if (settled) return
        settled = true
        cleanup()
        resolve({ watched: res?.isEnded === true })
      }

      ad.onClose(closeHandler)

      try {
        ad.show().catch((err: any) => {
          console.warn('[useRewardedVideoAd] show failed, retrying', err)
          ad.load()
            .then(() => ad.show())
            .catch((retryErr: any) => {
              settleFail(retryErr, 'retry')
            })
        })
      } catch (e) {
        settleFail(e, 'sync')
      }
    })
  }, [adUnitId, isWeapp, isDevtools])

  return { showAd, isReady, error }
}
