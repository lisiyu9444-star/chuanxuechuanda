import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { getStorage, signKey, DEFAULT_SIGN_EXPIRE_SECONDS } from './tos-utils'

/**
 * 前端静态资源（幸运星 IP、示例图、兜底图）的对象 key。
 * key 永久有效，访问 URL 由本控制器动态签发，避免硬编码签名 URL 过期失效。
 *
 * 注意：对象存储按环境隔离（代理层自动加环境前缀），本表中的 key 是
 * 首个环境上传时生成的；其他环境部署后需先调用 sync-static 完成同步，
 * 同步产生的新 key（带新 UUID 后缀）会被 getStaticAssets 自动发现，无需改表。
 */
const STATIC_ASSET_KEYS: Record<string, string> = {
  luckyStarHappy: 'IP_compressed_6a323948_c047943d.png',
  luckyStar1: 'IP_1_compressed_f0d6e24a_7dfb940f.png',
  luckyStar2: 'IP_2_compressed_a57a6f9c_b7bc3e89.png',
  luckyStar3: 'IP_3_compressed_87ca7563_071d78b5.png',
  luckyStar4: 'IP_4_compressed_89c2e4f5_195e56d6.png',
  exampleLuckyStar: 'Xing_Yun_Xing_Kai_Xin_06859ac3_c0ebcca2.png',
  exampleFlat: 'example_flat_compressed_fcb0c028_2340446d.jpg',
  exampleTryOn: 'example_tryon_compressed_2655e65c_38629783.jpg',
  fallback: 'placeholder_compressed_fc42a6fb_22887e81.jpg',
}

/** key 合法性：仅允许字母数字与 . _ - /，防路径穿越 */
const KEY_PATTERN = /^[A-Za-z0-9._\-/]{1,512}$/

/** sync-static 管理接口鉴权串（仅允许同步白名单内的静态资源） */
const SYNC_SECRET = 'assets-sync-3f8a2c7e91b44d6f9e0c5a2b8d7f1635a0e4'

/** 源 URL 白名单：仅允许从本平台 TOS 域名拉取 */
const SOURCE_URL_PATTERN = /^https:\/\/[^/]+\.tos\.coze\.site\//

/** key 解析结果内存缓存：name -> 实际 key（null 表示当前环境缺失） */
const resolvedKeyCache = new Map<string, { key: string | null; cachedAt: number }>()
const RESOLVE_CACHE_TTL = 5 * 60 * 1000

/**
 * 解析静态资源在当前环境中的实际对象 key。
 * 环境隔离导致各环境的实际 key 不同（UUID 后缀不同），按两级解析：
 * 1. fileExists(硬编码 key)：首个上传环境直接命中
 * 2. listFiles(去扩展名前缀)：发现 sync-static 上传的同源变体（取字典序最大者）
 */
async function resolveAssetKey(name: string, configuredKey: string): Promise<string | null> {
  const cached = resolvedKeyCache.get(name)
  if (cached && Date.now() - cached.cachedAt < RESOLVE_CACHE_TTL) return cached.key

  const storage = getStorage()
  let resolved: string | null = null
  try {
    if (await storage.fileExists({ fileKey: configuredKey })) {
      resolved = configuredKey
    } else {
      const prefix = configuredKey.replace(/\.[a-z0-9]+$/i, '')
      const listed = await storage.listFiles({ prefix, maxKeys: 20 })
      const variants = (listed.keys || []).filter((k) => typeof k === 'string' && k.length > 0).sort()
      if (variants.length > 0) resolved = variants[variants.length - 1]
    }
  } catch (e) {
    console.warn('[Assets] resolve key failed:', name, e)
  }
  resolvedKeyCache.set(name, { key: resolved, cachedAt: Date.now() })
  return resolved
}

@Controller('assets')
export class AssetsController {
  /**
   * 获取全部静态资源的签名 URL（30 天有效）。
   * 前端启动/进页面时拉取并本地缓存，替代硬编码签名 URL。
   * 当前环境缺失的资源返回空字符串，前端按无效整表处理（不缓存、走占位）。
   */
  @Get('static')
  @SkipThrottle()
  async getStaticAssets(): Promise<{ data: { assets: Record<string, string>; expiresIn: number } }> {
    const entries = await Promise.all(
      Object.entries(STATIC_ASSET_KEYS).map(async ([name, key]) => {
        const resolved = await resolveAssetKey(name, key)
        return [name, resolved ? await signKey(resolved) : ''] as const
      }),
    )
    return {
      data: {
        assets: Object.fromEntries(entries),
        expiresIn: DEFAULT_SIGN_EXPIRE_SECONDS,
      },
    }
  }

  /**
   * 一次性管理接口：将静态资源同步到当前环境的存储前缀下。
   * 新环境部署后硬编码 key 对应的对象并不存在，通过本接口从源签名 URL
   * 拉取文件重建；新 key 会被 getStaticAssets 的前缀发现机制自动识别。
   */
  @Post('sync-static')
  @HttpCode(200)
  @SkipThrottle()
  async syncStatic(
    @Body() body: { secret?: string; sources?: Record<string, string> },
  ): Promise<{ data: { synced: Record<string, string>; errors: Record<string, string> } }> {
    const synced: Record<string, string> = {}
    const errors: Record<string, string> = {}
    if (body?.secret !== SYNC_SECRET) {
      return { data: { synced, errors: { _auth: 'invalid secret' } } }
    }
    const sources = body?.sources && typeof body.sources === 'object' ? body.sources : {}
    const storage = getStorage()
    await Promise.all(
      Object.keys(STATIC_ASSET_KEYS).map(async (name) => {
        const url = sources[name]
        if (!url) {
          errors[name] = 'missing source url'
          return
        }
        if (!SOURCE_URL_PATTERN.test(url)) {
          errors[name] = 'source url not allowed'
          return
        }
        try {
          synced[name] = await storage.uploadFromUrl({ url, timeout: 30000 })
          resolvedKeyCache.delete(name)
        } catch (e) {
          errors[name] = e instanceof Error ? e.message : String(e)
        }
      }),
    )
    return { data: { synced, errors } }
  }

  /**
   * 批量换签：历史记录/分享记录中的图片 URL 过期后，用 key 换取新签名 URL。
   */
  @Post('refresh')
  @HttpCode(200)
  @SkipThrottle()
  async refreshUrls(@Body() body: { keys?: string[] }): Promise<{ data: { urls: Record<string, string> } }> {
    const keys = Array.isArray(body?.keys) ? body.keys.slice(0, 50) : []
    const urls: Record<string, string> = {}
    await Promise.all(
      keys.map(async (key) => {
        if (typeof key !== 'string' || !KEY_PATTERN.test(key) || key.includes('..')) return
        const signed = await signKey(key)
        if (signed) urls[key] = signed
      }),
    )
    return { data: { urls } }
  }
}
