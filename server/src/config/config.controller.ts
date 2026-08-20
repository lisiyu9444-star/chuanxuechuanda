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

          // 广告失败自动放行错误码白名单（严格模式下仍生效，无需手动切开关）：
          // 这些 errCode 表示广告位「确定性不可用」，继续拦截只会造成功能死锁：
          //   1002 = 广告单元无效   1005 = 广告组件审核中/被拒   1008 = 广告单元已关闭
          // 注意：1004（无合适广告）属暂时性无填充，不在白名单内，提示用户稍后重试；
          // 环境变量 AD_AUTO_SKIP_ERR_CODES 可用 JSON 数组覆盖，如 '[1002,1004,1005,1008]'
          adAutoSkipErrCodes: (() => {
            try {
              const parsed = JSON.parse(process.env.AD_AUTO_SKIP_ERR_CODES || '[1002,1005,1008]')
              return Array.isArray(parsed) ? parsed : [1002, 1005, 1008]
            } catch {
              return [1002, 1005, 1008]
            }
          })(),
        },
      },
    }
  }
}
