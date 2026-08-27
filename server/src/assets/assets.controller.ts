import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { Public } from '@/auth/public.decorator'
import { getStorage, signKey, clearResolvedKeyCache, resolveKeyVariant, DEFAULT_SIGN_EXPIRE_SECONDS } from './tos-utils'

/**
 * 前端静态资源（幸运星 IP、示例图、兜底图）的对象 key。
 * key 永久有效，访问 URL 由本控制器动态签发，避免硬编码签名 URL 过期失效。
 *
 * 注意：对象存储按环境隔离（代理层自动加环境前缀），本表中的 key 是
 * 首个环境上传时生成的；其他环境部署后需先调用 sync-static 完成同步，
 * 同步产生的新 key（带新 UUID 后缀）会被 getStaticAssets 自动发现，无需改表。
 */
const STATIC_ASSET_KEYS: Record<string, string> = {
  luckyStarHappy: 'IP_happy_transparent_eedd1cf7.png',
  luckyStar1: 'IP_1_transparent_ff53861e.png',
  luckyStar2: 'IP_2_transparent_c19ea2a6.png',
  luckyStar3: 'IP_3_transparent_b587c88c.png',
  luckyStar4: 'IP_4_transparent_1d723c4e.png',
  exampleLuckyStar: 'Xing_Yun_Xing_Kai_Xin_06859ac3_c0ebcca2.png',
  exampleFlat: 'example_flat_compressed_fcb0c028_2340446d.jpg',
  exampleTryOn: 'example_tryon_compressed_2655e65c_38629783.jpg',
  fallback: 'placeholder_compressed_fc42a6fb_22887e81.jpg',
}

/** key 合法性：仅允许字母数字与 . _ - /，防路径穿越 */
const KEY_PATTERN = /^[A-Za-z0-9._\-/]{1,512}$/

/**
 * sync-static 管理接口鉴权串：通过环境变量 ASSETS_SYNC_SECRET 配置。
 * 未配置时同步接口一律拒绝（fail-closed），源码不内置任何密钥。
 */
const getSyncSecret = (): string => process.env.ASSETS_SYNC_SECRET || ''

/** 源 URL 白名单：仅允许从本平台 TOS 域名拉取 */
const SOURCE_URL_PATTERN = /^https:\/\/[^/]+\.tos\.coze\.site\//

/** 静态资源 key 的变体解析统一走 tos-utils.resolveKeyVariant（环境隔离自愈，含缓存） */

@Public()
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
        const resolved = await resolveKeyVariant(key)
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
    @Body() body: { secret?: string; sources?: Record<string, string>; extraSources?: Record<string, string> },
  ): Promise<{ data: { synced: Record<string, string>; errors: Record<string, string> } }> {
    const synced: Record<string, string> = {}
    const errors: Record<string, string> = {}
    const syncSecret = getSyncSecret()
    if (!syncSecret) {
      return { data: { synced, errors: { _auth: 'sync disabled: ASSETS_SYNC_SECRET not configured' } } }
    }
    if (!body?.secret || body.secret !== syncSecret) {
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
        } catch (e) {
          errors[name] = e instanceof Error ? e.message : String(e)
        }
      }),
    )
    // 通用 key 同步：等级印章等未纳入 STATIC_ASSET_KEYS 的资源，按对象 key 提供源签名 URL。
    // 上传产生的变体 key（带新随机后缀）由 resolveKeyVariant 的前缀发现机制自动命中。
    const extraSources = body?.extraSources && typeof body.extraSources === 'object' ? body.extraSources : {}
    await Promise.all(
      Object.entries(extraSources).map(async ([key, url]) => {
        if (!KEY_PATTERN.test(key) || key.includes('..')) {
          errors[key] = 'invalid key'
          return
        }
        if (typeof url !== 'string' || !SOURCE_URL_PATTERN.test(url)) {
          errors[key] = 'source url not allowed'
          return
        }
        try {
          synced[key] = await storage.uploadFromUrl({ url, timeout: 30000 })
        } catch (e) {
          errors[key] = e instanceof Error ? e.message : String(e)
        }
      }),
    )
    // 同步成功后清空变体解析缓存，让新变体立即被发现（否则最多等 5 分钟 TTL）
    clearResolvedKeyCache()
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
