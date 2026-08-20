import type { RemoteAssets } from './remote-assets'

/**
 * 幸运指数 icon 素材名（对应 RemoteAssets 的 key）。
 * 实际 URL 由 remote-assets 模块动态签发，禁止再硬编码签名 URL（会过期）。
 * 每次展示时随机选取。
 */
export const LUCKY_STAR_ICON_NAMES = [
  'luckyStar1',
  'luckyStar2',
  'luckyStar3',
  'luckyStar4',
  'luckyStarHappy',
] as const satisfies readonly (keyof RemoteAssets)[]

export type LuckyStarIconName = (typeof LUCKY_STAR_ICON_NAMES)[number]
