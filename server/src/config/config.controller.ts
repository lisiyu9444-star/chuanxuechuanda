import { Controller, Get, HttpCode } from '@nestjs/common'

@Controller('config')
export class ConfigController {
  @Get('features')
  @HttpCode(200)
  async getFeatures() {
    return {
      data: {
        // 功能开关配置
        features: {
          // 审核时设为 false，通过后设为 true
          enableVideoUnlock: true,      // 视频解锁功能
          enableShareUnlock: true,      // 分享解锁功能
          enableBaZiDetail: true,       // 八字详情展示
          enableFavorableElement: true, // 喜用神分析
        },
      },
    }
  }
}
