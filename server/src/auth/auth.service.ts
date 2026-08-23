import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { desc, eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '@/storage/database/db'
import { privacyConsents, users } from '@/storage/database/schema'
import { DEV_USER, isStrictAuthMode, PRIVACY_VERSION } from './auth-config'

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
  privacyVersion: string
}

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  /** 微信登录：code 换 openid，创建/更新用户，签发 JWT */
  async wxLogin(code: string): Promise<LoginResult> {
    const { openid, unionid } = await this.resolveOpenid(code)

    const now = Date.now()
    const existing = await db.select().from(users).where(eq(users.openid, openid)).limit(1)

    let userId: string
    let isNewUser: boolean
    let nickname: string | null = null
    let avatarUrl: string | null = null

    if (existing.length > 0) {
      userId = existing[0].id
      nickname = existing[0].nickname
      avatarUrl = existing[0].avatarUrl
      isNewUser = false
      await db.update(users).set({ lastLoginAt: now, updatedAt: now }).where(eq(users.id, userId))
    } else {
      userId = uuidv4()
      isNewUser = true
      await db.insert(users).values({
        id: userId,
        openid,
        unionid: unionid || null,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
      })
    }

    const token = this.jwtService.sign({ sub: userId, openid })
    return { token, userId, isNewUser, nickname, avatarUrl, privacyVersion: PRIVACY_VERSION }
  }

  /** 严格模式走微信 code2Session；开发模式以 code 派生伪 openid */
  private async resolveOpenid(code: string): Promise<{ openid: string; unionid?: string }> {
    if (!isStrictAuthMode()) {
      return { openid: code === 'dev' ? DEV_USER.openid : `dev-${code}` }
    }

    const url =
      'https://api.weixin.qq.com/sns/jscode2session' +
      `?appid=${process.env.WX_APPID}` +
      `&secret=${process.env.WX_SECRET}` +
      `&js_code=${encodeURIComponent(code)}` +
      '&grant_type=authorization_code'

    let data: WxSessionResponse
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
      data = (await res.json()) as WxSessionResponse
    } catch (e) {
      console.error('[Auth] 调用微信 code2Session 异常:', e)
      throw new UnauthorizedException('微信服务调用失败，请稍后重试')
    }

    if (data.errcode || !data.openid) {
      console.error('[Auth] 微信 code2Session 失败:', data.errcode, data.errmsg)
      throw new UnauthorizedException(`微信登录失败: ${data.errmsg || '未知错误'}`)
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
  async verifyTokenOptional(token: string): Promise<{ userId: string; openid: string } | null> {
    try {
      const payload = await this.jwtService.verifyAsync<{ sub?: string; openid?: string }>(token)
      return payload?.sub ? { userId: payload.sub, openid: payload.openid || '' } : null
    } catch {
      return null
    }
  }
}
