import { Controller, Get, HttpCode } from '@nestjs/common'

@Controller('config')
export class ConfigController {
  @Get('features')
  @HttpCode(200)
  async getFeatures() {
    return {
      data: {
        // 功能开关配置
        // ============================================
        // 审核版本配置（提交审核时）：
        // - showHomeSubtitle: false        (隐藏首页副标题)
        // - showLoadingSteps: false        (隐藏 loading 步骤文案)
        // - showResultDetails: false       (隐藏结果页详情)
        // - enableVideoUnlock: false       (隐藏视频解锁)
        // - enableShareUnlock: false       (隐藏分享解锁)
        //
        // 正式版本配置（审核通过后）：
        // - 全部设为 true
        // ============================================
        features: {
          // 首页
          showHomeSubtitle: false,      // 首页副标题"根据你的生辰推荐每日穿搭"

          // Loading 页面
          showLoadingSteps: false,      // loading 步骤文案（四柱/旺缺/喜用神/穿搭）

          // 结果页
          showResultDetails: false,     // 结果页详情（八字概览/喜用神分析/穿搭推荐）

          // 功能开关
          enableVideoUnlock: true,     // 视频解锁功能
          enableShareUnlock: true,     // 分享解锁功能
        },
      },
    }
  }
}
