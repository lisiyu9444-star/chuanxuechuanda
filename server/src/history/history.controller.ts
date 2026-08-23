import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common'
import { and, desc, eq, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '@/storage/database/db'
import { baziRecords } from '@/storage/database/schema'
import { SaveRecordDto } from './history.dto'

@Controller('history')
export class HistoryController {
  /** 历史记录列表（分页） */
  @Get('list')
  async list(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('type') type?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1)
    const size = Math.min(50, Math.max(1, parseInt(pageSize || '20', 10) || 20))
    const conditions = [eq(baziRecords.userId, req.user.userId)]
    if (type) conditions.push(eq(baziRecords.type, type))
    const where = and(...conditions)

    const rows = await db
      .select()
      .from(baziRecords)
      .where(where)
      .orderBy(desc(baziRecords.createdAt))
      .limit(size)
      .offset((pageNum - 1) * size)

    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(baziRecords)
      .where(where)
    const total = countRows[0]?.count ?? 0

    return { data: { list: rows, total, page: pageNum, pageSize: size } }
  }

  /**
   * 保存一条 AI 生成记录（幂等：携带 clientId 时同记录重复保存执行更新）。
   * 原子 upsert（INSERT ... ON CONFLICT (user_id, client_id) DO UPDATE），避免并发唯一索引冲突；
   * 更新时各字段采用 COALESCE(新值, 旧值)，未传字段保留原值。
   */
  @Post('save')
  @HttpCode(200)
  async save(@Req() req: any, @Body() body: SaveRecordDto) {
    const clientId = body?.clientId || null

    if (clientId) {
      const rows = await db
        .insert(baziRecords)
        .values({
          id: uuidv4(),
          userId: req.user.userId,
          clientId,
          profileId: body?.profileId || null,
          type: body?.type || 'daily',
          nickname: body?.nickname || '',
          gender: body?.gender || '',
          result: body?.result || '',
          imageUrl: body?.imageUrl || null,
          tryOnUrl: body?.tryOnUrl || null,
          llmPlan: body?.llmPlan || null,
          luckyScore: body?.luckyScore || null,
          createdAt: Date.now(),
        })
        .onConflictDoUpdate({
          target: [baziRecords.userId, baziRecords.clientId],
          set: {
            profileId: sql`coalesce(${body?.profileId ?? null}, ${baziRecords.profileId})`,
            type: sql`coalesce(${body?.type ?? null}, ${baziRecords.type})`,
            nickname: sql`coalesce(${body?.nickname ?? null}, ${baziRecords.nickname})`,
            gender: sql`coalesce(${body?.gender ?? null}, ${baziRecords.gender})`,
            result: sql`coalesce(${body?.result ?? null}, ${baziRecords.result})`,
            imageUrl: sql`coalesce(${body?.imageUrl ?? null}, ${baziRecords.imageUrl})`,
            tryOnUrl: sql`coalesce(${body?.tryOnUrl ?? null}, ${baziRecords.tryOnUrl})`,
            llmPlan: sql`coalesce(${body?.llmPlan ?? null}, ${baziRecords.llmPlan})`,
            luckyScore: sql`coalesce(${body?.luckyScore ?? null}, ${baziRecords.luckyScore})`,
          },
        })
        // xmax = 0 表示本次为新插入，否则为冲突更新
        .returning({ id: baziRecords.id, isNew: sql<boolean>`(xmax = 0)` })
      return { data: { id: rows[0].id, updated: !rows[0].isNew } }
    }

    const id = uuidv4()
    await db.insert(baziRecords).values({
      id,
      userId: req.user.userId,
      clientId,
      profileId: body?.profileId || null,
      type: body?.type || 'daily',
      nickname: body?.nickname || '',
      gender: body?.gender || '',
      result: body?.result || '',
      imageUrl: body?.imageUrl || null,
      tryOnUrl: body?.tryOnUrl || null,
      llmPlan: body?.llmPlan || null,
      luckyScore: body?.luckyScore || null,
      createdAt: Date.now(),
    })
    return { data: { id, updated: false } }
  }

  /** 记录详情 */
  @Get(':id')
  async detail(@Req() req: any, @Param('id') id: string) {
    const rows = await db.select().from(baziRecords).where(eq(baziRecords.id, id)).limit(1)
    const record = rows[0]
    if (!record || record.userId !== req.user.userId) {
      return { data: null }
    }
    return { data: record }
  }

  /** 删除记录（按服务端 id，仅本人记录；deleted 标识是否真实删除） */
  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const rows = await db
      .delete(baziRecords)
      .where(and(eq(baziRecords.id, id), eq(baziRecords.userId, req.user.userId)))
      .returning({ id: baziRecords.id })
    return { data: { success: true, deleted: !!rows[0] } }
  }

  /** 删除记录（按前端本地记录 clientId，用于本地删除联动） */
  @Delete('client/:clientId')
  async removeByClientId(@Req() req: any, @Param('clientId') clientId: string) {
    await db
      .delete(baziRecords)
      .where(and(eq(baziRecords.userId, req.user.userId), eq(baziRecords.clientId, clientId)))
    return { data: { success: true } }
  }

  /** 清空本人全部历史记录 */
  @Delete()
  async clearAll(@Req() req: any) {
    await db.delete(baziRecords).where(eq(baziRecords.userId, req.user.userId))
    return { data: { success: true } }
  }
}
