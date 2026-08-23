import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { DEV_USER, isStrictAuthMode } from './auth-config'
import { IS_PUBLIC_KEY } from './public.decorator'

/**
 * 全局 JWT 鉴权守卫（在 AppModule 注册为 APP_GUARD）。
 * - @Public() 标记的接口直接放行
 * - 携带 Bearer token：校验通过后注入 req.user = { userId, openid }
 * - 未携带 token：开发模式注入固定 dev 用户放行；严格模式（生产）返回 401
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const req = context.switchToHttp().getRequest()
    const authHeader: string = req.headers?.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

    if (token) {
      try {
        const payload = await this.jwtService.verifyAsync<{ sub?: string; openid?: string }>(token)
        if (!payload?.sub) throw new Error('missing sub')
        req.user = { userId: payload.sub, openid: payload.openid || '' }
        return true
      } catch {
        throw new UnauthorizedException('请先登录')
      }
    }

    if (!isStrictAuthMode()) {
      req.user = { ...DEV_USER }
      return true
    }
    throw new UnauthorizedException('请先登录')
  }
}
