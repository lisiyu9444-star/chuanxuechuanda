import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// 直接使用环境变量中的数据库连接字符串
const dbUrl = process.env.PGDATABASE_URL || '';

if (!dbUrl) {
  throw new Error('PGDATABASE_URL environment variable is required');
}

// 创建连接池
const pool = new Pool({
  connectionString: dbUrl,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// 创建 Drizzle ORM 实例
export const db = drizzle(pool, { schema });
