import Taro from '@tarojs/taro'

/**
 * 渠道常量（运行时判断）
 *
 * IS_DOUYIN 基于 Taro.getEnv() 运行时判断：
 * - 抖音小程序 → IS_DOUYIN = true
 * - 微信小程序 / H5 预览 → IS_DOUYIN = false
 * 双渠道互不影响，无需手动切换，也无需区分构建命令。
 *
 * SHOW_METAPHYSICS：是否展示命理/运势相关内容（八字概览、喜用神分析、
 * 幸运指数、本命穿搭等）。抖音审核期间为 false，页面呈现为纯穿搭工具。
 * 恢复微信展示无需改动——微信环境运行时自动为 true。
 */
export const IS_DOUYIN = Taro.getEnv() === Taro.ENV_TYPE.TT

/** 是否展示玄学（命理/运势）内容 */
export const SHOW_METAPHYSICS = !IS_DOUYIN
