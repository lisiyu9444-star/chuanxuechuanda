import * as path from 'path'
import * as fs from 'fs'
import Database = require('better-sqlite3')

const DB_PATH = path.join(process.cwd(), 'data', 'shares.db')

// 确保 data 目录存在
const dataDir = path.join(process.cwd(), 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const db: Database.Database = new Database(DB_PATH)

// 启用 WAL 模式，提高并发性能
db.pragma('journal_mode = WAL')

// 创建分享表
db.exec(`
  CREATE TABLE IF NOT EXISTS shares (
    id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    gender TEXT NOT NULL,
    result TEXT NOT NULL,
    tryOnUrl TEXT,
    createdAt INTEGER NOT NULL,
    expiresAt INTEGER NOT NULL
  )
`)

// 启动时清理过期数据
const cleanupStmt = db.prepare('DELETE FROM shares WHERE expiresAt < ?')
const cleanupResult = cleanupStmt.run(Date.now())
if (cleanupResult.changes > 0) {
  console.log(`[Database] Cleaned up ${cleanupResult.changes} expired shares`)
}

export default db
