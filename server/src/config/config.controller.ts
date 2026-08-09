import { Controller, Get, Post, Body, HttpCode } from '@nestjs/common'
import { ConfigService } from './config.service'

@Controller('config')
export class ConfigController {
  constructor(private configService: ConfigService) {}

  @Get('features')
  @HttpCode(200)
  async getFeatures() {
    // 确保默认配置已初始化
    await this.configService.initializeDefaultFeatures()

    const features = await this.configService.getAllFeatures()

    return {
      data: {
        features,
      },
    }
  }

  @Post('features/update')
  @HttpCode(200)
  async updateFeature(@Body() body: { key: string; value: boolean }) {
    const { key, value } = body

    if (!key || typeof value !== 'boolean') {
      return {
        data: {
          success: false,
          message: '参数错误：key 和 value 为必填项',
        },
      }
    }

    await this.configService.updateFeature(key, value)

    return {
      data: {
        success: true,
        message: `配置 ${key} 已更新为 ${value}`,
      },
    }
  }
}
