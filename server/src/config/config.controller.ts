import { Controller, Get, HttpCode } from '@nestjs/common'

@Controller('config')
export class ConfigController {
  @Get('features')
  @HttpCode(200)
  async getFeatures() {
    return {
      data: {
        // 功能开关配置 - 通过环境变量控制
        // ============================================
        // 审核版本：在扣子平台"环境变量"中设置为 false
        // 正式版本：在扣子平台"环境变量"中设置为 true 或删除变量
        //
        // 环境变量列表：
        // - SHOW_LOADING_STEPS    (loading 步骤文案)
        // - SHOW_RESULT_DETAILS   (结果页详情)
        // - ENABLE_VIDEO_UNLOCK   (视频解锁)
        // - ENABLE_SHARE_UNLOCK   (分享解锁)
        // - AD_FAIL_OPEN          (广告失败兜底放行)
        //
        // 默认值：true（正式版本）
        // ============================================
        features: {
          // Loading 页面
          showLoadingSteps: process.env.SHOW_LOADING_STEPS !== 'false',

          // 结果页
          showResultDetails: process.env.SHOW_RESULT_DETAILS !== 'false',

          // 功能开关
          enableVideoUnlock: process.env.ENABLE_VIDEO_UNLOCK !== 'false',
          enableShareUnlock: process.env.ENABLE_SHARE_UNLOCK !== 'false',

          // 激励视频广告失败兜底（默认 false 严格模式，广告位已审核通过）：
          // true  = 广告加载/展示失败时直接放行解锁（广告位异常时的临时降级方案）
          // false = 广告失败不放行，提示用户稍后重试（默认，正式环境）
          adFailOpen: process.env.AD_FAIL_OPEN === 'true',
        },
      },
    }
  }
}
