/**
 * 鉴权模式与常量配置。
 *
 * 严格模式（生产）：配置了 WX_APPID + WX_SECRET，所有受保护接口强制 JWT。
 * 开发模式（默认）：未配置微信凭证，无法真实登录——
 *   1. /api/auth/login 接受任意 code，直接以 code 派生伪 openid 签发 token（便于联调多账号）
 *   2. JwtAuthGuard 对无 token 请求注入固定 dev 用户，H5 预览/本地开发不受鉴权阻塞
 *
 * 安全约束（fail-closed）：
 * - JWT_SECRET 在生产环境必须通过环境变量配置，缺失时拒绝启动
 * - 开发 bypass / dev 登录仅在「非生产 + 未配置微信凭证」时开放；
 *   生产环境缺少微信凭证视为配置错误，受保护接口一律 503，不降级放行
 */
export const isProduction = (): boolean => process.env.NODE_ENV === 'production'

export const isStrictAuthMode = (): boolean => !!(process.env.WX_APPID && process.env.WX_SECRET)

const DEV_JWT_SECRET = 'dev-only-jwt-secret-change-me-in-prod'

/**
 * JWT 密钥获取：优先环境变量 JWT_SECRET。
 * 生产环境未配置时抛错（JwtModule 注册阶段即失败，服务拒绝启动）；
 * 本地开发允许使用内置回退值并打印警告。
 */
export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET
  if (secret) return secret
  if (isProduction()) {
    throw new Error('[Auth] JWT_SECRET 未配置：生产环境必须通过环境变量设置 JWT_SECRET，服务拒绝启动')
  }
  console.warn('[Auth] JWT_SECRET 未配置，使用开发回退值（仅限本地开发，禁止用于生产）')
  return DEV_JWT_SECRET
}

export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
export const PRIVACY_VERSION = process.env.PRIVACY_VERSION || '1.0'

/** 开发模式下未携带 token 时的兜底用户 */
export const DEV_USER = { userId: 'dev-local-user', openid: 'dev-local-openid' }

/**
 * 开发 bypass 是否允许：仅「非生产环境」且「未配置微信凭证」。
 * 生产环境未配置微信凭证属于配置错误，必须 fail-closed（不放行任何请求）。
 */
export const isDevBypassAllowed = (): boolean => !isProduction() && !isStrictAuthMode()
