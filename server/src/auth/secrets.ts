import { randomBytes } from 'crypto'
import { sql } from 'drizzle-orm'
import { db } from '../storage/database/db'

/**
 * 应用密钥的数据库自举（bootstrap）管理。
 *
 * 背景：部分部署环境没有平台环境变量的配置权限。为保证 JWT_SECRET 这类关键密钥
 * 「不入源码、可持久化、重启不失效、免配置权限」，采用数据库自举方案：
 *   1. 环境变量优先：配置了 JWT_SECRET 就直接使用（便于运维显式管理与轮换）
 *   2. 未配置则查 app_secrets 表；不存在则生成强随机密钥写入（ON CONFLICT DO NOTHING）
 *   3. 多实例并发启动时重新 SELECT 收敛到同一值（先写入者胜）
 *   4. 数据库不可用时抛错（fail-closed：宁可启动失败，也不用弱密钥运行）
 *
 * 安全性说明：密钥与业务数据同库存储，防护等级与数据库一致；
 * 相比硬编码回退值，攻击者无法从源码推导出密钥。
 * 密钥轮换：更新环境变量，或删除 app_secrets 表中 jwt_secret 行后重启
 * （轮换后旧 token 全部失效，前端 401 自动重登机制可兜底恢复）。
 */

const JWT_SECRET_KEY = 'jwt_secret'
const WX_APPID_KEY = 'wx_appid'
const WX_SECRET_KEY = 'wx_secret'

let tableReady: Promise<void> | null = null

/** 确保密钥表存在（幂等，进程内只执行一次；失败允许下次重试） */
function ensureSecretsTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS app_secrets (
          key varchar(64) PRIMARY KEY,
          value varchar(256) NOT NULL,
          created_at bigint NOT NULL,
          updated_at bigint NOT NULL
        )
      `)
    })().catch(err => {
      tableReady = null
      throw err
    })
  }
  return tableReady
}

const readSecret = async (key: string): Promise<string | null> => {
  const result = await db.execute(sql`SELECT value FROM app_secrets WHERE key = ${key} LIMIT 1`)
  const row = result.rows?.[0] as { value?: string } | undefined
  return row?.value || null
}

/**
 * 解析 JWT 密钥：环境变量 JWT_SECRET 优先，否则数据库自举持久化。
 * 仅用于 JwtModule 注册（启动阶段）；失败时抛错使服务拒绝启动。
 */
export async function resolveJwtSecret(): Promise<string> {
  const fromEnv = process.env.JWT_SECRET
  if (fromEnv) return fromEnv

  await ensureSecretsTable()

  const existing = await readSecret(JWT_SECRET_KEY)
  if (existing) {
    console.log('[Auth] JWT_SECRET 未配置环境变量，已复用数据库中的持久密钥')
    return existing
  }

  // 首次启动：生成强随机密钥并持久化；并发实例下以先写入者为准
  const generated = randomBytes(48).toString('base64url')
  const now = Date.now()
  await db.execute(sql`
    INSERT INTO app_secrets (key, value, created_at, updated_at)
    VALUES (${JWT_SECRET_KEY}, ${generated}, ${now}, ${now})
    ON CONFLICT (key) DO NOTHING
  `)
  const finalValue = await readSecret(JWT_SECRET_KEY)
  if (!finalValue) {
    throw new Error('[Auth] JWT 密钥自举失败：数据库写入后未读到值，服务拒绝启动')
  }
  console.log('[Auth] JWT_SECRET 未配置环境变量，已生成强随机密钥并持久化到数据库（重启不失效）')
  return finalValue
}

// ==================== 微信小程序凭证（数据库配置支持） ====================

/**
 * 与 JWT 自举同理：部分部署环境没有平台环境变量配置权限，
 * WX_APPID / WX_SECRET 支持持久化到 app_secrets 表（通过 /api/admin/wx-config 首次初始化写入）。
 *
 * 解析优先级：环境变量 > app_secrets 表 > null（未配置）。
 * 进程内缓存：启动时加载一次 + 管理接口写入时刷新，避免每个请求查库。
 */

export interface WxCredentials {
  appid: string
  secret: string
}

/** 内存缓存：null 表示未加载过；无凭证时缓存为 'none' 哨兵避免重复查库 */
let wxCredentialsCache: WxCredentials | null | 'none' = null

/** 启动时加载微信凭证缓存（幂等；DB 失败静默降级为未配置，由业务侧 fail-closed 兜底） */
export async function loadWxCredentialsCache(): Promise<void> {
  try {
    await ensureSecretsTable()
    const appid = await readSecret(WX_APPID_KEY)
    const secret = await readSecret(WX_SECRET_KEY)
    wxCredentialsCache = appid && secret ? { appid, secret } : 'none'
    if (wxCredentialsCache !== 'none' && wxCredentialsCache) {
      console.log('[Auth] 已从数据库加载微信小程序凭证（appid 尾部: ...' + wxCredentialsCache.appid.slice(-4) + '）')
    }
  } catch (e) {
    console.warn('[Auth] 加载微信凭证缓存失败（按未配置处理）:', e instanceof Error ? e.message : e)
    wxCredentialsCache = 'none'
  }
}

/**
 * 获取微信凭证：环境变量优先，其次进程缓存（数据库配置）。
 * 返回 null 表示未配置。
 */
export function getWxCredentials(): WxCredentials | null {
  const envAppid = process.env.WX_APPID
  const envSecret = process.env.WX_SECRET
  if (envAppid && envSecret) return { appid: envAppid, secret: envSecret }
  return wxCredentialsCache && wxCredentialsCache !== 'none' ? wxCredentialsCache : null
}

/** 保存微信凭证到数据库并刷新缓存（UPSERT；返回写入前的旧 secret 供管理接口鉴权比对） */
export async function saveWxCredentials(appid: string, secret: string): Promise<string | null> {
  await ensureSecretsTable()
  const previous = await readSecret(WX_SECRET_KEY)
  const now = Date.now()
  await db.execute(sql`
    INSERT INTO app_secrets (key, value, created_at, updated_at)
    VALUES (${WX_APPID_KEY}, ${appid}, ${now}, ${now}), (${WX_SECRET_KEY}, ${secret}, ${now}, ${now})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
  `)
  wxCredentialsCache = { appid, secret }
  return previous
}
