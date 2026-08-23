import { Body, Controller, ForbiddenException, HttpCode, Post } from '@nestjs/common'
import { Public } from '@/auth/public.decorator'
import { getWxCredentials, saveWxCredentials } from '@/auth/secrets'

interface WxConfigDto {
  appid?: string
  secret?: string
  /** 轮换凭证时必须携带当前生效的 secret 进行校验（首次初始化无需提供） */
  currentSecret?: string
}

/**
 * 管理配置接口（一次性初始化设计）。
 *
 * 背景：部分部署环境没有平台环境变量配置权限，微信凭证通过本接口持久化到 app_secrets 表。
 *
 * 状态机鉴权（不依赖 JWT，因为此时登录体系可能尚不可用）：
 * - 首次初始化（数据库无 wx_secret）：允许直接写入——部署后应第一时间完成配置
 * - 轮换（已有凭证）：必须携带当前生效的 secret 校验，防止被篡改
 * - 环境变量已配置 WX_APPID/WX_SECRET：接口禁用（env 优先级最高，DB 配置无意义）
 *
 * 安全说明：secret 不出现在任何日志与响应中；appid 仅日志打印尾部 4 位。
 */
@Controller('admin')
export class AdminController {
  /** 配置微信小程序凭证（首次免密初始化，之后需 currentSecret 校验） */
  @Public()
  @Post('wx-config')
  @HttpCode(200)
  async configureWxCredentials(@Body() body: WxConfigDto) {
    // 环境变量已配置时禁用 DB 配置（避免双来源歧义）
    if (process.env.WX_APPID && process.env.WX_SECRET) {
      throw new ForbiddenException('环境变量已配置微信凭证，无需通过本接口配置')
    }

    const appid = (body?.appid || '').trim()
    const secret = (body?.secret || '').trim()
    if (!appid || !secret) {
      throw new ForbiddenException('appid 与 secret 均不能为空')
    }
    if (appid.length > 64 || secret.length > 128) {
      throw new ForbiddenException('参数长度异常')
    }

    const existing = getWxCredentials()
    if (existing) {
      // 轮换路径：必须校验当前生效的 secret
      if (!body?.currentSecret || body.currentSecret !== existing.secret) {
        throw new ForbiddenException('当前密钥校验失败，拒绝更新')
      }
    }

    await saveWxCredentials(appid, secret)
    console.log(
      `[Admin] 微信凭证已${existing ? '轮换' : '初始化'}（appid 尾部: ...${appid.slice(-4)}），严格模式登录已启用`
    )
    return { data: { success: true, initialized: !existing } }
  }
}
