import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { desc, eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '@/storage/database/db'
import { privacyConsents, users } from '@/storage/database/schema'
import { DEV_USER, isDevBypassAllowed, PRIVACY_VERSION } from './auth-config'
import { getWxCredentials } from './secrets'

interface WxSessionResponse {
  openid?: string
  session_key?: string
  unionid?: string
  errcode?: number
  errmsg?: string
}

export interface LoginResult {
  token: string
  userId: string
  isNewUser: boolean
  nickname: string | null
  avatarUrl: string | null
  displayId: string
  privacyVersion: string
}

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  /** 生成全局唯一的随机数字 ID（8 位，如 16109284），冲突时重试 */
  private async generateDisplayId(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = String(10000000 + Math.floor(Math.random() * 90000000))
      const dup = await db.select({ id: users.id }).from(users).where(eq(users.displayId, candidate)).limit(1)
      if (dup.length === 0) return candidate
    }
    // 理论几乎不可达；兜底用 10 位降低碰撞域
    return String(1000000000 + Math.floor(Math.random() * 9000000000))
  }

  /** 微信登录：code 换 openid，创建/更新用户，签发 JWT */
  async wxLogin(code: string): Promise<LoginResult> {
    const { openid, unionid } = await this.resolveOpenid(code)

    const now = Date.now()
    const existing = await db.select().from(users).where(eq(users.openid, openid)).limit(1)

    let userId: string
    let isNewUser: boolean
    let nickname: string | null = null
    let avatarUrl: string | null = null
    let displayId: string | null = null

    if (existing.length > 0) {
      userId = existing[0].id
      nickname = existing[0].nickname
      avatarUrl = existing[0].avatarUrl
      displayId = existing[0].displayId
      isNewUser = false
      // 老用户首次升级到本版本时补发数字 ID
      if (!displayId) {
        displayId = await this.generateDisplayId()
      }
      await db.update(users).set({ lastLoginAt: now, updatedAt: now, displayId }).where(eq(users.id, userId))
    } else {
      userId = uuidv4()
      isNewUser = true
      displayId = await this.generateDisplayId()
      await db.insert(users).values({
        id: userId,
        openid,
        unionid: unionid || null,
        displayId,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
      })
    }

    // payload 只携带 userId（sub），openid 等敏感标识不进 token
    const token = this.jwtService.sign({ sub: userId })
    return { token, userId, isNewUser, nickname, avatarUrl, displayId, privacyVersion: PRIVACY_VERSION }
  }

  /** 严格模式走微信 code2Session；开发模式映射到固定伪身份（仅本地开发可用） */
  private async resolveOpenid(code: string): Promise<{ openid: string; unionid?: string }> {
    const credentials = getWxCredentials()
    if (!credentials) {
      // 生产环境未配置微信凭证属于配置错误：登录 fail-closed，不允许任意 code 派生身份
      if (!isDevBypassAllowed()) {
        throw new ServiceUnavailableException('登录服务未配置，暂不可用')
      }
      // 开发放行模式下身份必须稳定：Taro.login() 返回的 code 是微信下发的一次性
      // 随机码，若用它派生 openid，每次登录都会生成不同 openid、创建新用户，
      // 导致系统 ID（displayId）漂移。故统一映射到固定开发用户；
      // 仅显式 'dev-' 前缀的 code 保留确定性多用户模拟（同 code 同身份）。
      return { openid: code.startsWith('dev-') ? code : DEV_USER.openid }
    }

    // 注意：微信 jscode2session 仅支持 query 传参，secret 必须出现在 URL 中（微信 API 设计）。
    // 因此禁止把该 URL 写入任何日志或错误响应，下方日志均做脱敏处理。
    const url =
      'https://api.weixin.qq.com/sns/jscode2session' +
      `?appid=${encodeURIComponent(credentials.appid)}` +
      `&secret=${encodeURIComponent(credentials.secret)}` +
      `&js_code=${encodeURIComponent(code)}` +
      '&grant_type=authorization_code'

    let data: WxSessionResponse
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
      data = (await res.json()) as WxSessionResponse
    } catch (e) {
      // 仅记录错误消息，不打印可能包含完整 URL（含 secret）的错误对象
      console.error('[Auth] 调用微信 code2Session 异常:', e instanceof Error ? e.message : 'unknown')
      throw new UnauthorizedException('微信服务调用失败，请稍后重试')
    }

    if (data.errcode || !data.openid) {
      // 微信侧错误详情只进服务端日志，对外统一脱敏文案
      console.error('[Auth] 微信 code2Session 失败, errcode:', data.errcode)
      throw new UnauthorizedException('微信登录失败，请稍后重试')
    }
    return { openid: data.openid, unionid: data.unionid }
  }

  async updateUserInfo(userId: string, nickname?: string, avatarUrl?: string): Promise<void> {
    const updateData: Record<string, string | number> = { updatedAt: Date.now() }
    if (nickname !== undefined) updateData.nickname = nickname
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl
    await db.update(users).set(updateData).where(eq(users.id, userId))
  }

  async getUserById(userId: string) {
    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    return rows[0] || null
  }

  /** 记录一次隐私协议同意（留痕） */
  async recordPrivacyConsent(userId: string, version: string): Promise<void> {
    const now = Date.now()
    await db.insert(privacyConsents).values({ id: uuidv4(), userId, version, agreedAt: now, createdAt: now })
  }

  async getLatestConsentedVersion(userId: string): Promise<string | null> {
    const rows = await db
      .select()
      .from(privacyConsents)
      .where(eq(privacyConsents.userId, userId))
      .orderBy(desc(privacyConsents.agreedAt))
      .limit(1)
    return rows[0]?.version || null
  }

  /** 供公开接口（如分享）可选解析 token：无 token 或无效时返回 null，不抛错 */
  async verifyTokenOptional(token: string): Promise<{ userId: string } | null> {
    try {
      const payload = await this.jwtService.verifyAsync<{ sub?: string }>(token)
      return payload?.sub ? { userId: payload.sub } : null
    } catch {
      return null
    }
  }
}
