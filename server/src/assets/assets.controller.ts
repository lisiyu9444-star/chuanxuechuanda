import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { signKey, DEFAULT_SIGN_EXPIRE_SECONDS } from './tos-utils'

/**
 * 前端静态资源（幸运星 IP、示例图、兜底图）的对象 key。
 * key 永久有效，访问 URL 由本控制器动态签发，避免硬编码签名 URL 过期失效。
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

@Controller('assets')
export class AssetsController {
  /**
   * 获取全部静态资源的签名 URL（30 天有效）。
   * 前端启动/进页面时拉取并本地缓存，替代硬编码签名 URL。
   */
  @Get('static')
  @SkipThrottle()
  async getStaticAssets(): Promise<{ data: { assets: Record<string, string>; expiresIn: number } }> {
    const entries = await Promise.all(
      Object.entries(STATIC_ASSET_KEYS).map(async ([name, key]) => [name, await signKey(key)] as const),
    )
    return {
      data: {
        assets: Object.fromEntries(entries),
        expiresIn: DEFAULT_SIGN_EXPIRE_SECONDS,
      },
    }
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
