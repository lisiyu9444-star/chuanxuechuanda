import { Body, Controller, Get, HttpCode, Post, Req, UnauthorizedException } from '@nestjs/common'
import { AuthService } from './auth.service'
import { Public } from './public.decorator'
import { PRIVACY_VERSION } from './auth-config'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** 微信登录：{ code, nickname?, avatarUrl? } → token + 用户信息 */
  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { code?: string; nickname?: string; avatarUrl?: string }) {
    if (!body?.code) {
      throw new UnauthorizedException('缺少 code 参数')
    }
    const result = await this.authService.wxLogin(body.code)
    if (body.nickname || body.avatarUrl) {
      await this.authService.updateUserInfo(result.userId, body.nickname, body.avatarUrl)
      result.nickname = body.nickname || result.nickname
      result.avatarUrl = body.avatarUrl || result.avatarUrl
    }
    return { data: result }
  }

  /** 当前用户信息（含最新隐私协议同意版本） */
  @Get('me')
  async me(@Req() req: any) {
    const user = await this.authService.getUserById(req.user.userId)
    const latestConsentedVersion = await this.authService.getLatestConsentedVersion(req.user.userId)
    return {
      data: {
        userId: req.user.userId,
        openid: user?.openid || '',
        nickname: user?.nickname || null,
        avatarUrl: user?.avatarUrl || null,
        privacyVersion: PRIVACY_VERSION,
        latestConsentedVersion,
      },
    }
  }

  /** 更新用户资料 */
  @Post('update-profile')
  @HttpCode(200)
  async updateProfile(@Req() req: any, @Body() body: { nickname?: string; avatarUrl?: string }) {
    await this.authService.updateUserInfo(req.user.userId, body?.nickname, body?.avatarUrl)
    return { data: { success: true } }
  }

  /** 记录隐私协议同意（服务端留痕） */
  @Post('privacy-consent')
  @HttpCode(200)
  async recordPrivacyConsent(@Req() req: any, @Body() body: { version?: string }) {
    const version = body?.version || PRIVACY_VERSION
    await this.authService.recordPrivacyConsent(req.user.userId, version)
    return { data: { success: true, version } }
  }

  /** 当前隐私协议版本（公开） */
  @Public()
  @Get('privacy-version')
  async getPrivacyVersion() {
    return { data: { version: PRIVACY_VERSION } }
  }
}
