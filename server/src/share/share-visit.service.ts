import { Injectable, Logger } from '@nestjs/common'
import { createHash } from 'crypto'
import { and, eq, gt, sql } from 'drizzle-orm'
import { db } from '@/storage/database/db'
import { shareVisits } from '@/storage/database/schema'
import { AuthService } from '@/auth/auth.service'

/** 分享类型：fashion=穿搭测评分享（fashion_ratings.id），bazi=八字穿搭结果分享（shares.id） */
export type ShareType = 'fashion' | 'bazi'

/** 访问记录上下文（由 controller 从请求中提取后传入） */
export interface VisitContext {
  authorization?: string
  ip?: string
  userAgent?: string
}

/** 同一访客对同一分享的去重窗口：24 小时内重复访问只记一次（PV/UV 同口径） */
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000

let tableReady: Promise<void> | null = null

/**
 * 确保访问统计表存在（幂等，进程内只执行一次；失败允许下次重试）。
 * 与 auth/secrets.ts 的数据库自举同模式：无迁移工具的部署环境下，
 * 开发/生产均在首次记录访问时自动建表建索引，无需人工执行 DDL。
 */
function ensureShareVisitsTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS share_visits (
          id varchar(64) PRIMARY KEY,
          share_type varchar(20) NOT NULL,
          share_id varchar(64) NOT NULL,
          sharer_user_id varchar(64),
          visitor_user_id varchar(64),
          visitor_key varchar(128) NOT NULL,
          visited_at bigint NOT NULL
        )
      `)
      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS share_visits_share_idx ON share_visits (share_type, share_id, visited_at)`,
      )
      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS share_visits_sharer_idx ON share_visits (sharer_user_id, visited_at)`,
      )
      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS share_visits_dedup_idx ON share_visits (share_type, share_id, visitor_key, visited_at)`,
      )
    })().catch(err => {
      tableReady = null
      throw err
    })
  }
  return tableReady
}

/** 从请求中提取客户端 IP（优先代理头 x-forwarded-for 的首个地址） */
export function getClientIp(req: any): string {
  const forwarded = req?.headers?.['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim()
  return req?.ip || req?.socket?.remoteAddress || ''
}

@Injectable()
export class ShareVisitService {
  private readonly logger = new Logger(ShareVisitService.name)

  constructor(private readonly authService: AuthService) {}

  /**
   * 记录一次分享访问。调用方应以 fire-and-forget 方式调用并自行 catch，
   * 不得阻塞或影响业务接口响应。
   *
   * 口径：
   * - 已登录访客按 userId 识别（前端 Network 全局注入 Authorization，识别率高）
   * - 未登录访客按 IP+UA 的 sha256 匿名指纹识别
   * - 分享者本人打开自己的分享不计入
   * - 同一访客 24 小时内重复访问同一分享只记一次
   */
  async recordVisit(
    shareType: ShareType,
    shareId: string,
    sharerUserId: string | null | undefined,
    ctx: VisitContext,
  ): Promise<void> {
    await ensureShareVisitsTable()

    // 访客身份：Bearer token 优先，降级为 IP+UA 匿名指纹
    let visitorUserId: string | null = null
    const token = ctx.authorization?.startsWith('Bearer ') ? ctx.authorization.slice(7) : ''
    if (token) {
      visitorUserId = (await this.authService.verifyTokenOptional(token))?.userId || null
    }

    // 分享者本人预览不计入访问统计
    if (visitorUserId && sharerUserId && visitorUserId === sharerUserId) return

    const visitorKey = visitorUserId
      ? `u:${visitorUserId}`
      : `a:${createHash('sha256').update(`${ctx.ip || ''}|${ctx.userAgent || ''}`).digest('hex').slice(0, 32)}`

    // 24 小时去重窗口内已记录过则跳过
    const now = Date.now()
    const recent = await db
      .select({ id: shareVisits.id })
      .from(shareVisits)
      .where(
        and(
          eq(shareVisits.shareType, shareType),
          eq(shareVisits.shareId, shareId),
          eq(shareVisits.visitorKey, visitorKey),
          gt(shareVisits.visitedAt, now - DEDUP_WINDOW_MS),
        ),
      )
      .limit(1)
    if (recent.length > 0) return

    await db.insert(shareVisits).values({
      id: `visit_${now}_${Math.random().toString(36).substring(2, 9)}`,
      shareType,
      shareId,
      sharerUserId: sharerUserId || null,
      visitorUserId,
      visitorKey,
      visitedAt: now,
    })
    this.logger.log(
      `Share visit recorded: ${shareType}/${shareId} by ${visitorUserId ? `user ${visitorUserId}` : 'anonymous'}`,
    )
  }
}
