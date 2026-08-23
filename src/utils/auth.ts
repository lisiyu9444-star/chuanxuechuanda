import Taro from '@tarojs/taro'
import { Network } from '@/network'

/**
 * 微信登录与隐私协议工具（仅微信小程序启用）。
 *
 * 流程：
 * 1. 小程序启动 → 检查本地隐私协议同意状态（版本匹配）
 * 2. 已同意 → 后台静默登录（wx.login → /api/auth/login → JWT）
 * 3. 所有请求由 Network 层自动注入 Authorization: Bearer <token>
 * 4. 收到 401 → 清除 token 并后台静默重登（当前请求不重试，保住 abort 能力）
 *
 * H5/抖音端：不启用登录与隐私弹窗，后端在开发模式下会注入 dev 用户。
 */

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

/** 当前隐私协议版本，需与服务端 PRIVACY_VERSION 保持一致 */
export const CURRENT_PRIVACY_VERSION = '1.0'
const PRIVACY_CONSENT_KEY = 'privacy_consent_version'

export interface AuthUser {
  userId: string
  nickname: string | null
  avatarUrl: string | null
}

/** 仅微信小程序启用登录体系 */
export const isWeappEnv = (): boolean => Taro.getEnv() === Taro.ENV_TYPE.WEAPP

function safeGet<T>(key: string, fallback: T): T {
  try {
    const v = Taro.getStorageSync(key)
    return v === undefined || v === null || v === '' ? fallback : (v as T)
  } catch {
    return fallback
  }
}

function safeSet(key: string, value: unknown): void {
  try {
    Taro.setStorageSync(key, value)
  } catch (e) {
    console.warn('[Auth] storage set failed:', key, e)
  }
}

function safeRemove(key: string): void {
  try {
    Taro.removeStorageSync(key)
  } catch {
    /* ignore */
  }
}

// ==================== Token 管理 ====================

export function getToken(): string {
  return safeGet<string>(TOKEN_KEY, '')
}

export function getAuthUser(): AuthUser | null {
  return safeGet<AuthUser | null>(USER_KEY, null)
}

export function isLoggedIn(): boolean {
  return !!getToken()
}

export function clearAuth(): void {
  safeRemove(TOKEN_KEY)
  safeRemove(USER_KEY)
}

// ==================== 隐私协议 ====================

/** 本地是否已同意当前版本的隐私协议 */
export function hasAgreedPrivacy(): boolean {
  return safeGet<string>(PRIVACY_CONSENT_KEY, '') === CURRENT_PRIVACY_VERSION
}

function markPrivacyAgreedLocal(): void {
  safeSet(PRIVACY_CONSENT_KEY, CURRENT_PRIVACY_VERSION)
}

/** 同意隐私协议：本地记录 + 静默登录 + 服务端留痕 */
export async function agreePrivacy(): Promise<boolean> {
  markPrivacyAgreedLocal()
  const ok = await silentLogin()
  if (ok) {
    // 服务端留痕（失败不阻塞，下次启动 me 接口可补）
    try {
      await Network.request({
        url: '/api/auth/privacy-consent',
        method: 'POST',
        data: { version: CURRENT_PRIVACY_VERSION },
      })
    } catch (e) {
      console.warn('[Auth] report privacy consent failed:', e)
    }
  }
  return ok
}

// ==================== 静默登录 ====================

let loginPromise: Promise<boolean> | null = null

/**
 * 静默登录（微信）：wx.login 拿 code → 后端换 openid → 签发 JWT。
 * 并发安全：多次调用共享同一次登录流程。
 */
export function silentLogin(): Promise<boolean> {
  if (!isWeappEnv()) return Promise.resolve(false)
  if (loginPromise) return loginPromise

  loginPromise = (async () => {
    try {
      const loginRes = await Taro.login()
      if (!loginRes.code) {
        console.warn('[Auth] wx.login 未返回 code')
        return false
      }
      const res = await Network.request({
        url: '/api/auth/login',
        method: 'POST',
        data: { code: loginRes.code },
      })
      const data = res.data?.data
      if (res.statusCode === 200 && data?.token) {
        safeSet(TOKEN_KEY, data.token)
        safeSet(USER_KEY, {
          userId: data.userId,
          nickname: data.nickname || null,
          avatarUrl: data.avatarUrl || null,
        } as AuthUser)
        console.log('[Auth] 静默登录成功, userId:', data.userId)
        return true
      }
      console.warn('[Auth] 登录接口异常:', res.statusCode, res.data)
      return false
    } catch (e) {
      console.warn('[Auth] 静默登录失败:', e)
      return false
    } finally {
      loginPromise = null
    }
  })()

  return loginPromise
}

/** 确保已登录（已同意隐私协议的前提下），返回是否已持有 token */
export async function ensureLoggedIn(): Promise<boolean> {
  if (!isWeappEnv()) return false
  if (getToken()) return true
  if (!hasAgreedPrivacy()) return false
  return silentLogin()
}

/**
 * AI 功能准入检查：调用 AI 接口前调用。
 * - 非微信小程序：直接放行（后端开发模式注入 dev 用户）
 * - 已登录：放行
 * - 未登录但已同意隐私协议：尝试静默登录，成功则放行
 * - 未同意隐私协议：拒绝（隐私弹窗此时应正覆盖页面，用户需先同意）
 * - 登录失败：toast 提示并拒绝
 */
export async function ensureAiAccess(): Promise<boolean> {
  if (!isWeappEnv()) return true
  if (getToken()) return true
  if (!hasAgreedPrivacy()) return false
  const ok = await silentLogin()
  if (!ok) {
    Taro.showToast({ title: '登录失败，请稍后重试', icon: 'none', duration: 2000 })
  }
  return ok
}

/** 退出登录：仅清除本地凭证，服务端无状态 */
export function logout(): void {
  clearAuth()
  safeRemove(PRIVACY_CONSENT_KEY)
}

// ==================== 注册 Network 鉴权钩子 ====================

let hooksRegistered = false

export function setupAuthHooks(): void {
  if (hooksRegistered) return
  hooksRegistered = true
  Network.setAuthHooks({
    getAuthHeader: (): Record<string, string> => {
      const token = getToken()
      return token ? { Authorization: `Bearer ${token}` } : {}
    },
    onUnauthorized: () => {
      // token 失效/未登录：清除后后台静默重登，当前请求不重试
      console.warn('[Auth] 收到 401，清除 token 并尝试静默重登')
      clearAuth()
      if (isWeappEnv() && hasAgreedPrivacy()) {
        void silentLogin()
      }
    },
  })
}
