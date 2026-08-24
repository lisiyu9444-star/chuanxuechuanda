import type { RemoteAssets } from './remote-assets'

/**
 * 幸运指数 icon 素材名（对应 RemoteAssets 的 key）。
 * 实际 URL 由 remote-assets 模块动态签发，禁止再硬编码签名 URL（会过期）。
 * 非示例档案按「档案 ID + 当天日期」从库中选取一张展示（按天轮换）。
 */
export const LUCKY_STAR_ICON_NAMES = [
  'luckyStar1',
  'luckyStar2',
  'luckyStar3',
  'luckyStar4',
  'luckyStarHappy',
] as const satisfies readonly (keyof RemoteAssets)[]

export type LuckyStarIconName = (typeof LUCKY_STAR_ICON_NAMES)[number]

/**
 * 按种子字符串稳定选取一张幸运星图：
 * 相同种子始终命中同一张（同一天内展示稳定，不会刷新跳图），
 * 不同种子（不同档案 / 不同日期）均匀散列到库中各图。
 */
export function pickLuckyStarIconName(seed: string): LuckyStarIconName {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  return LUCKY_STAR_ICON_NAMES[Math.abs(hash) % LUCKY_STAR_ICON_NAMES.length]
}
