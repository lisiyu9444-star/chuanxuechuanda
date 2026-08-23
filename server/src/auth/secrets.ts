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
