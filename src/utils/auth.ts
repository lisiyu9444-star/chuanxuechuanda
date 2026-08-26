import Taro from '@tarojs/taro'
import { Network } from '@/network'
import { setCurrentArchiveId, DEFAULT_ARCHIVE } from './archiveStorage'
import { loginSheetStore } from './login-sheet-store'

/**
 * 微信登录与隐私协议工具（仅微信小程序启用）。
 *
 * 流程：
 * 1. 小程序启动 → 检查本地隐私协议同意状态（版本匹配）
 * 2. 已同意 → 后台静默登录（wx.login → /api/auth/login → JWT）
 * 3. 所有请求由 Network 层自动注入 Authorization: Bearer <token>
 * 4. 收到 401 → 清除 token 并静默重登；重登成功后 Network 层自动重试一次原请求（对业务透明）
 *
 * 登录门禁（数据与登录状态绑定）：
 * - 未登录仅可浏览示例档案；添加档案 / AI 生成 / 历史记录均需登录
 * - 业务入口统一调用 requireLogin()：已登录放行；未同意隐私 → 唤起全局登录弹层（LoginSheet，
 *   勾选协议 + 微信快捷登录）；已同意但无 token → 静默重登
 * - 登录/退出通过 AUTH_EVENTS 广播，各页面监听后刷新视图
 * - 登录成功后服务端下发随机数字 ID（displayId），「我的」页展示为 ID: xxxxxxxx
 *
 * H5/抖音端：不启用登录与隐私弹窗，后端在开发模式下会注入 dev 用户。
 */

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

/** 当前隐私协议版本，需与服务端 PRIVACY_VERSION 保持一致 */
export const CURRENT_PRIVACY_VERSION = '1.1'
const PRIVACY_CONSENT_KEY = 'privacy_consent_version'

export interface AuthUser {
  userId: string
  nickname: string | null
  avatarUrl: string | null
  /** 对外展示的随机数字 ID（如 16109284），登录时由服务端下发 */
  displayId: string | null
}

/** 仅微信小程序启用登录体系 */
export const isWeappEnv = (): boolean => Taro.getEnv() === Taro.ENV_TYPE.WEAPP

// ==================== 登录状态事件总线 ====================

/**
 * 登录状态相关事件（Taro.eventCenter）。
 * 页面（档案列表/历史记录/我的等）监听 LOGIN_SUCCESS / LOGOUT 后刷新视图。
 * 登录弹层的唤起不经事件总线：requireLogin 直接调用 loginSheetStore.open()，
 * 各页面挂载的 LoginSheet 实例通过 store 订阅同步（小程序端 App 组件不渲染 UI）。
 */
export const AUTH_EVENTS = {
  /** 登录成功广播（静默登录/登录弹层完成后） */
  LOGIN_SUCCESS: 'auth:login-success',
  /** 退出登录广播（各页面据此恢复示例/空态） */
  LOGOUT: 'auth:logout',
} as const

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
        // 登录请求自身不参与 401 自动重试：否则 login 401 → 触发静默重登 → 等待自身 loginPromise，死锁
        _skipAuthRetry: true,
      } as Parameters<typeof Network.request>[0])
      const data = res.data?.data
      if (res.statusCode === 200 && data?.token) {
        safeSet(TOKEN_KEY, data.token)
        safeSet(USER_KEY, {
          userId: data.userId,
          nickname: data.nickname || null,
          avatarUrl: data.avatarUrl || null,
          displayId: data.displayId || null,
        } as AuthUser)
        console.log('[Auth] 静默登录成功, userId:', data.userId)
        // 广播登录成功：档案列表/历史记录等页面监听后恢复用户数据视图
        Taro.eventCenter.trigger(AUTH_EVENTS.LOGIN_SUCCESS)
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
 * 规则与 requireLogin 一致：未登录时唤起全局登录弹层，用户完成登录后重新触发即可。
 */
export async function ensureAiAccess(): Promise<boolean> {
  return requireLogin()
}

/**
 * 统一登录门禁：业务入口（添加档案 / AI 生成 / 历史记录等）调用。
 * - 非微信小程序：直接放行（后端开发模式注入 dev 用户）
 * - 已登录：放行
 * - 未登录且未同意隐私协议：唤起全局登录弹层（勾选协议 + 微信快捷登录），本次操作拒绝，登录成功后重新触发即可
 * - 未登录但已同意隐私协议：尝试静默重登（无需打扰用户）
 */
export async function requireLogin(): Promise<boolean> {
  if (!isWeappEnv()) return true
  if (getToken()) return true
  if (!hasAgreedPrivacy()) {
    console.log('[Auth] requireLogin: 未登录，唤起登录弹层')
    loginSheetStore.open()
    return false
  }
  const ok = await silentLogin()
  if (!ok) {
    Taro.showToast({ title: '登录失败，请稍后重试', icon: 'none', duration: 2000 })
  }
  return ok
}

/**
 * 退出登录：清除本地凭证（服务端无状态），并恢复到示例档案视图。
 * 本地档案/历史数据保留（重新登录后恢复展示），仅切换当前视角为示例档案。
 */
export function logout(): void {
  clearAuth()
  safeRemove(PRIVACY_CONSENT_KEY)
  // 视角切回示例档案：首页等页面 useDidShow 重新加载后即展示示例数据
  setCurrentArchiveId(DEFAULT_ARCHIVE.id)
  Taro.eventCenter.trigger(AUTH_EVENTS.LOGOUT)
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
    onUnauthorized: async (): Promise<boolean> => {
      // token 失效/未登录：清除后静默重登；返回是否恢复成功（Network 层据此自动重试原请求）
      console.warn('[Auth] 收到 401，清除 token 并尝试静默重登')
      clearAuth()
      if (!isWeappEnv() || !hasAgreedPrivacy()) return false
      return silentLogin()
    },
  })
}
