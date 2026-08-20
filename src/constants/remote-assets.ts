import Taro from '@tarojs/taro'
import { Network } from '@/network'

/**
 * 远程静态资源（幸运星 IP、示例图、兜底图）动态签发模块。
 *
 * 背景：TOS 签名 URL 带有效期，硬编码到前端必然过期（曾导致首页/示例/兜底图集中失效）。
 * 对象 key 永久有效，因此改为后端持有 key、前端按需拉取签名 URL（30 天有效），
 * 本地缓存 7 天强制换签，彻底消除过期风险。
 */
export interface RemoteAssets {
  luckyStarHappy: string
  luckyStar1: string
  luckyStar2: string
  luckyStar3: string
  luckyStar4: string
  exampleLuckyStar: string
  exampleFlat: string
  exampleTryOn: string
  fallback: string
}

const STORAGE_KEY = 'remote_assets_v1'
/** 本地缓存 7 天（URL 本身 30 天有效，提前换签留足余量） */
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000

let memoryCache: RemoteAssets | null = null
let pendingPromise: Promise<RemoteAssets | null> | null = null

/**
 * 获取远程资源 URL 表（内存 -> 本地缓存 -> 网络，三级）。
 * 失败返回 null，调用方需做空值兜底（如占位背景）。
 */
export async function ensureRemoteAssets(): Promise<RemoteAssets | null> {
  if (memoryCache) return memoryCache

  try {
    const cached = Taro.getStorageSync(STORAGE_KEY)
    if (cached?.assets?.fallback && Date.now() - cached.savedAt < CACHE_TTL) {
      memoryCache = cached.assets as RemoteAssets
      return memoryCache
    }
  } catch {
    // 缓存读取失败继续走网络
  }

  if (pendingPromise) return pendingPromise

  pendingPromise = (async () => {
    try {
      const res = await Network.request({ url: '/api/assets/static', method: 'GET' })
      const assets = (res as any)?.data?.data?.assets as RemoteAssets | undefined
      if (assets?.fallback) {
        memoryCache = assets
        try {
          Taro.setStorageSync(STORAGE_KEY, { assets, savedAt: Date.now() })
        } catch {
          // 存储失败不影响使用
        }
        return assets
      }
      console.warn('[RemoteAssets] unexpected response:', (res as any)?.data)
    } catch (e) {
      console.warn('[RemoteAssets] fetch failed:', e)
    }
    return null
  })()

  try {
    return await pendingPromise
  } finally {
    pendingPromise = null
  }
}

/**
 * 批量换签：历史记录中的图片 URL 过期后，用持久化的 key 换取新签名 URL。
 * 返回 key -> 新 URL 映射（失败/非法 key 会被跳过）。
 */
export async function refreshImageUrls(keys: string[]): Promise<Record<string, string>> {
  const validKeys = Array.from(new Set(keys.filter((k) => typeof k === 'string' && k.length > 0)))
  if (validKeys.length === 0) return {}
  try {
    const res = await Network.request({
      url: '/api/assets/refresh',
      method: 'POST',
      data: { keys: validKeys },
    })
    return ((res as any)?.data?.data?.urls as Record<string, string>) || {}
  } catch (e) {
    console.warn('[RemoteAssets] refresh failed:', e)
    return {}
  }
}

/** 从（可能已过期的）TOS 签名 URL 提取对象 key，供旧数据迁移使用 */
export function extractTosKeyFromUrl(url?: string): string {
  if (!url || typeof url !== 'string') return ''
  try {
    const path = url.split('?')[0]
    const match = path.match(/^https?:\/\/[^/]+\.tos\.coze\.site\/(.+)$/)
    return match?.[1] ? decodeURIComponent(match[1]) : ''
  } catch {
    return ''
  }
}
