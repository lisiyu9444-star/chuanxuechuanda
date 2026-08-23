/**
 * 鉴权模式与常量配置。
 *
 * 严格模式（生产）：配置了 WX_APPID + WX_SECRET，所有受保护接口强制 JWT。
 * 开发模式（默认）：未配置微信凭证，无法真实登录——
 *   1. /api/auth/login 接受任意 code，直接以 code 派生伪 openid 签发 token（便于联调多账号）
 *   2. JwtAuthGuard 对无 token 请求注入固定 dev 用户，H5 预览/本地开发不受鉴权阻塞
 *
 * 安全约束（fail-closed）：
 * - JWT 密钥由 secrets.ts 的 resolveJwtSecret() 解析：环境变量 JWT_SECRET 优先，
 *   未配置则数据库自举持久化；数据库不可用时服务拒绝启动。源码不含任何硬编码密钥。
 * - 开发 bypass / dev 登录仅在「非生产 + 未配置微信凭证」时开放；
 *   生产环境缺少微信凭证视为配置错误，受保护接口一律 503，不降级放行
 */
export const isProduction = (): boolean => process.env.NODE_ENV === 'production'

export const isStrictAuthMode = (): boolean => !!(process.env.WX_APPID && process.env.WX_SECRET)

export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
export const PRIVACY_VERSION = process.env.PRIVACY_VERSION || '1.0'

/** 开发模式下未携带 token 时的兜底用户 */
export const DEV_USER = { userId: 'dev-local-user', openid: 'dev-local-openid' }

/**
 * 开发 bypass 是否允许：仅「非生产环境」且「未配置微信凭证」。
 * 生产环境未配置微信凭证属于配置错误，必须 fail-closed（不放行任何请求）。
 */
export const isDevBypassAllowed = (): boolean => !isProduction() && !isStrictAuthMode()
