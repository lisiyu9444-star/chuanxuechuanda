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
        // - SHOW_HOME_SUBTITLE    (首页副标题)
        // - SHOW_LOADING_STEPS    (loading 步骤文案)
        // - SHOW_RESULT_DETAILS   (结果页详情)
        // - ENABLE_VIDEO_UNLOCK   (视频解锁)
        // - ENABLE_SHARE_UNLOCK   (分享解锁)
        //
        // 默认值：true（正式版本）
        // ============================================
        features: {
          // 首页
          showHomeSubtitle: process.env.SHOW_HOME_SUBTITLE !== 'false',

          // Loading 页面
          showLoadingSteps: process.env.SHOW_LOADING_STEPS !== 'false',

          // 结果页
          showResultDetails: process.env.SHOW_RESULT_DETAILS !== 'false',

          // 功能开关
          enableVideoUnlock: process.env.ENABLE_VIDEO_UNLOCK !== 'false',
          enableShareUnlock: process.env.ENABLE_SHARE_UNLOCK !== 'false',
        },
      },
    }
  }
}
