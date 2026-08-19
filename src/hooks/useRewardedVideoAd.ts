import { useCallback, useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'

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

interface UseRewardedVideoAdOptions {
  /** 广告单元 ID */
  adUnitId: string
  /** 广告加载/播放错误回调 */
  onError?: (err: any) => void
}

interface UseRewardedVideoAdReturn {
  /** 展示广告，返回用户是否完整观看 */
  showAd: () => Promise<boolean>
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
 */
const adInstanceCache = new Map<string, RewardedVideoAdInstance>()
const adPreloadedSet = new Set<string>()

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

/** 预加载仅在实例创建后执行一次，失败日志降为 warn（SDK 内部会自行重试） */
function preloadOnce(adUnitId: string, ad: RewardedVideoAdInstance) {
  if (adPreloadedSet.has(adUnitId)) return
  adPreloadedSet.add(adUnitId)
  try {
    ad.load().catch((err: any) => {
      // SDK 内部竞态（如 e.adProxy 未就绪）导致的预加载失败，SDK 会自动恢复，仅提示
      console.warn('[useRewardedVideoAd] preload failed (SDK will retry)', err)
    })
  } catch (e) {
    console.warn('[useRewardedVideoAd] preload sync error', e)
  }
}

/**
 * 微信小程序激励视频广告 Hook
 *
 * 功能：
 * - 仅在微信小程序环境初始化
 * - 广告实例全局单例复用，页面加载时预加载
 * - 提供 showAd 方法，返回 Promise<boolean> 表示用户是否完整观看
 * - H5 / 抖音小程序等非微信环境直接返回 false，由业务方决定是否放行
 *
 * @example
 * ```tsx
 * const { showAd, isReady } = useRewardedVideoAd({ adUnitId: 'adunit-xxx' })
 *
 * const handleUnlock = async () => {
 *   const isWeapp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP
 *   if (isWeapp) {
 *     const watched = await showAd()
 *     if (!watched) {
 *       Taro.showToast({ title: '请完整观看视频以解锁', icon: 'none' })
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
      onError?.(err)
    }

    const handleClose = (res: { isEnded: boolean }) => {
      console.log('[useRewardedVideoAd] close', res)
    }

    ad.onLoad(handleLoad)
    ad.onError(handleError)
    ad.onClose(handleClose)

    // 预加载广告，提升展示成功率（每个实例仅执行一次）
    preloadOnce(adUnitId, ad)

    return () => {
      // 仅摘除本组件的事件监听，不 destroy 实例（单例复用，避免 SDK 原生组件清理竞态）
      ad.offLoad(handleLoad)
      ad.offError(handleError)
      ad.offClose(handleClose)
      adRef.current = null
    }
  }, [adUnitId, isWeapp, isDevtools, onError])

  const showAd = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      // 开发者工具中广告 SDK 不可用，直接视为已完整观看，方便开发调试
      if (isDevtools) {
        resolve(true)
        return
      }
      if (!isWeapp || !adRef.current) {
        resolve(false)
        return
      }

      const ad = adRef.current
      let closeHandler: ((res: { isEnded: boolean }) => void) | null = null

      const cleanup = () => {
        if (closeHandler) {
          ad.offClose(closeHandler)
        }
      }

      closeHandler = (res: { isEnded: boolean }) => {
        cleanup()
        resolve(res.isEnded)
      }

      ad.onClose(closeHandler)

      try {
        ad.show().catch((err: any) => {
          console.warn('[useRewardedVideoAd] show failed, retrying', err)
          ad.load()
            .then(() => ad.show())
            .catch((retryErr: any) => {
              console.error('[useRewardedVideoAd] show retry failed', retryErr)
              cleanup()
              resolve(false)
            })
        })
      } catch (e) {
        console.error('[useRewardedVideoAd] show sync error', e)
        cleanup()
        resolve(false)
      }
    })
  }, [isWeapp, isDevtools])

  return { showAd, isReady, error }
}
