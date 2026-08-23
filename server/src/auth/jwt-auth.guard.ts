import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { DEV_USER, isDevBypassAllowed, isStrictAuthMode } from './auth-config'
import { IS_PUBLIC_KEY } from './public.decorator'
import { REQUIRE_AUTH_KEY } from './require-auth.decorator'

/**
 * 全局 JWT 鉴权守卫（在 AppModule 注册为 APP_GUARD）。
 * - @Public() 标记的接口直接放行（类级 @Public 可被方法级 @RequireAuth() 覆盖）
 * - 携带 Bearer token：校验通过后注入 req.user = { userId }
 * - 未携带 token：仅本地开发模式注入固定 dev 用户放行；其余情况 401
 * - 生产环境未配置微信凭证：配置错误，fail-closed 返回 503，不降级放行
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requireAuth = this.reflector.getAllAndOverride<boolean>(REQUIRE_AUTH_KEY, [
      context.getHandler(),
    ])
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic && !requireAuth) return true

    const req = context.switchToHttp().getRequest()
    const authHeader: string = req.headers?.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

    if (token) {
      try {
        const payload = await this.jwtService.verifyAsync<{ sub?: string }>(token)
        if (!payload?.sub) throw new Error('missing sub')
        req.user = { userId: payload.sub }
        return true
      } catch {
        throw new UnauthorizedException('请先登录')
      }
    }

    if (isDevBypassAllowed()) {
      req.user = { userId: DEV_USER.userId }
      return true
    }
    if (!isStrictAuthMode()) {
      // 生产环境缺少微信凭证：服务配置错误，拒绝放行
      throw new ServiceUnavailableException('服务端鉴权配置缺失，暂不可用')
    }
    throw new UnauthorizedException('请先登录')
  }
}
