import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Post, Req } from '@nestjs/common'
import { and, desc, eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '@/storage/database/db'
import { dailyResults } from '@/storage/database/schema'

/**
 * 每日运势结果缓存（前端 DAILY_RESULTS_KEY）的云端存储。
 * 与前端 archiveStorage 的写操作一一对应：
 * - saveDailyResult            → POST /save（幂等 upsert）
 * - clearDailyResultsByArchive → DELETE /archive/:archiveId
 * - clearDailyResult           → DELETE /:archiveId/:date
 */
@Controller('daily-results')
export class DailyResultsController {
  /** 我的每日运势缓存列表（云端恢复用，按更新时间倒序，上限 500 条） */
  @Get('list')
  async list(@Req() req: any) {
    const rows = await db
      .select()
      .from(dailyResults)
      .where(eq(dailyResults.userId, req.user.userId))
      .orderBy(desc(dailyResults.updatedAt))
      .limit(500)
    return { data: rows }
  }

  /**
   * 保存每日运势缓存（幂等 upsert，唯一键 user_id+archive_id+date）。
   * result 为完整 DailyResult 对象（jsonb 原样存储，恢复时直接回写本地）。
   */
  @Post('save')
  @HttpCode(200)
  async save(@Req() req: any, @Body() body: { archiveId?: string; date?: string; result?: unknown }) {
    const archiveId = typeof body?.archiveId === 'string' ? body.archiveId.trim() : ''
    const date = typeof body?.date === 'string' ? body.date.trim() : ''
    if (!archiveId || !date || body?.result === undefined || body?.result === null) {
      throw new BadRequestException('archiveId/date/result 不能为空')
    }
    const now = Date.now()
    const rows = await db
      .insert(dailyResults)
      .values({
        id: uuidv4(),
        userId: req.user.userId,
        archiveId,
        date,
        result: body.result,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [dailyResults.userId, dailyResults.archiveId, dailyResults.date],
        set: { result: body.result, updatedAt: now },
      })
      .returning({ id: dailyResults.id })
    return { data: { id: rows[0]?.id, success: true } }
  }

  /** 删除某档案下全部每日缓存（删除档案/换日重新生成联动）。注意：必须声明在 :archiveId/:date 之前，避免被通配路由吞掉 */
  @Delete('archive/:archiveId')
  async removeByArchive(@Req() req: any, @Param('archiveId') archiveId: string) {
    const rows = await db
      .delete(dailyResults)
      .where(and(eq(dailyResults.userId, req.user.userId), eq(dailyResults.archiveId, archiveId)))
      .returning({ id: dailyResults.id })
    return { data: { success: true, deleted: rows.length } }
  }

  /** 删除单条每日缓存（对应前端 clearDailyResult） */
  @Delete(':archiveId/:date')
  async removeOne(@Req() req: any, @Param('archiveId') archiveId: string, @Param('date') date: string) {
    const rows = await db
      .delete(dailyResults)
      .where(
        and(
          eq(dailyResults.userId, req.user.userId),
          eq(dailyResults.archiveId, archiveId),
          eq(dailyResults.date, date),
        ),
      )
      .returning({ id: dailyResults.id })
    return { data: { success: true, deleted: rows.length } }
  }
}
