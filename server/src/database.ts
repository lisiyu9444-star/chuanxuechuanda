// 使用 require 导入 better-sqlite3（CommonJS 模块）
// eslint-disable-next-line @typescript-eslint/no-var-requires
const DatabaseConstructor = require('better-sqlite3')
import { join } from 'path'
import { mkdirSync } from 'fs'

// 数据库文件路径（存储在 server 目录下）
const DB_PATH = join(__dirname, '..', 'data', 'lucky-outfit.db')

// 确保 data 目录存在
mkdirSync(join(__dirname, '..', 'data'), { recursive: true })

// 创建数据库连接
const db = new DatabaseConstructor(DB_PATH)

// 启用 WAL 模式（更好的并发性能）
db.pragma('journal_mode = WAL')

// 创建分享表
db.exec(`
  CREATE TABLE IF NOT EXISTS shares (
    id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    gender TEXT NOT NULL,
    outfitResult TEXT NOT NULL,
    imageUrl TEXT NOT NULL,
    tryOnUrl TEXT,
    createdAt INTEGER NOT NULL,
    expiresAt INTEGER NOT NULL
  )
`)

// 创建索引
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_shares_expires ON shares(expiresAt)
`)

// 定期清理过期数据（每小时）
const cleanupExpired = () => {
  const now = Date.now()
  db.prepare('DELETE FROM shares WHERE expiresAt < ?').run(now)
  console.log('[Database] Cleaned up expired shares')
}

// 启动时清理一次
cleanupExpired()

// 每小时清理一次
setInterval(cleanupExpired, 60 * 60 * 1000)

export default db
