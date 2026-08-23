import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common'
import { and, desc, eq, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '@/storage/database/db'
import { baziRecords } from '@/storage/database/schema'

interface SaveRecordBody {
  /** 前端本地记录 id（幂等键）：同用户 + clientId 已存在时执行更新而非新增 */
  clientId?: string
  profileId?: string
  type?: string
  nickname?: string
  gender?: string
  result?: string
  imageUrl?: string
  tryOnUrl?: string
  llmPlan?: string
  luckyScore?: string
}

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

  /** 保存一条 AI 生成记录（幂等：携带 clientId 时同记录重复保存执行更新） */
  @Post('save')
  @HttpCode(200)
  async save(@Req() req: any, @Body() body: SaveRecordBody) {
    const clientId = body?.clientId || null

    if (clientId) {
      const existing = await db
        .select()
        .from(baziRecords)
        .where(and(eq(baziRecords.userId, req.user.userId), eq(baziRecords.clientId, clientId)))
        .limit(1)
      if (existing[0]) {
        // 更新图片/结果字段（后续补丁如试穿图、平铺图换签后同步更新）
        await db
          .update(baziRecords)
          .set({
            profileId: body?.profileId ?? existing[0].profileId,
            type: body?.type ?? existing[0].type,
            nickname: body?.nickname ?? existing[0].nickname,
            gender: body?.gender ?? existing[0].gender,
            result: body?.result ?? existing[0].result,
            imageUrl: body?.imageUrl ?? existing[0].imageUrl,
            tryOnUrl: body?.tryOnUrl ?? existing[0].tryOnUrl,
            llmPlan: body?.llmPlan ?? existing[0].llmPlan,
            luckyScore: body?.luckyScore ?? existing[0].luckyScore,
          })
          .where(eq(baziRecords.id, existing[0].id))
        return { data: { id: existing[0].id, updated: true } }
      }
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

  /** 删除记录（按服务端 id） */
  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const rows = await db.select().from(baziRecords).where(eq(baziRecords.id, id)).limit(1)
    if (rows[0] && rows[0].userId === req.user.userId) {
      await db.delete(baziRecords).where(eq(baziRecords.id, id))
    }
    return { data: { success: true } }
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
