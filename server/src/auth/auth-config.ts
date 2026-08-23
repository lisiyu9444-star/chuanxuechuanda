/**
 * 鉴权模式与常量配置。
 *
 * 严格模式（生产）：配置了 WX_APPID + WX_SECRET，所有受保护接口强制 JWT。
 * 开发模式（默认）：未配置微信凭证，无法真实登录——
 *   1. /api/auth/login 接受任意 code，直接以 code 派生伪 openid 签发 token（便于联调多账号）
 *   2. JwtAuthGuard 对无 token 请求注入固定 dev 用户，H5 预览/本地开发不受鉴权阻塞
 */
export const isStrictAuthMode = (): boolean => !!(process.env.WX_APPID && process.env.WX_SECRET)

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-jwt-secret-change-me-in-prod'
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
export const PRIVACY_VERSION = process.env.PRIVACY_VERSION || '1.0'

/** 开发模式下未携带 token 时的兜底用户 */
export const DEV_USER = { userId: 'dev-local-user', openid: 'dev-local-openid' }
