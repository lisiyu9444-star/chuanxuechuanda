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
 * 微信小程序激励视频广告 Hook
 *
 * 功能：
 * - 仅在微信小程序环境初始化
 * - 页面加载时预加载广告
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

  useEffect(() => {
    if (!isWeapp) return
    if (typeof Taro.createRewardedVideoAd !== 'function') {
      console.warn('[useRewardedVideoAd] createRewardedVideoAd not available')
      return
    }

    try {
      const ad = Taro.createRewardedVideoAd({ adUnitId }) as RewardedVideoAdInstance
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

      // 预加载广告，提升展示成功率
      ad.load().catch((err: any) => {
        console.error('[useRewardedVideoAd] preload failed', err)
      })

      return () => {
        ad.offLoad(handleLoad)
        ad.offError(handleError)
        ad.offClose(handleClose)
        ad.destroy?.()
        adRef.current = null
      }
    } catch (e) {
      console.error('[useRewardedVideoAd] init failed', e)
      setError(e)
    }
  }, [adUnitId, isWeapp, onError])

  const showAd = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
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

      ad.show().catch((err: any) => {
        console.error('[useRewardedVideoAd] show failed, retrying', err)
        ad.load()
          .then(() => ad.show())
          .catch((retryErr: any) => {
            console.error('[useRewardedVideoAd] show retry failed', retryErr)
            cleanup()
            resolve(false)
          })
      })
    })
  }, [isWeapp])

  return { showAd, isReady, error }
}
