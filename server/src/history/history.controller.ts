import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common'
import { and, desc, eq, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '@/storage/database/db'
import { baziRecords } from '@/storage/database/schema'

interface SaveRecordBody {
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

  /** 保存一条 AI 生成记录（异步双写，前端在生成完成后调用） */
  @Post('save')
  @HttpCode(200)
  async save(@Req() req: any, @Body() body: SaveRecordBody) {
    const id = uuidv4()
    await db.insert(baziRecords).values({
      id,
      userId: req.user.userId,
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
    return { data: { id } }
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

  /** 删除记录 */
  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const rows = await db.select().from(baziRecords).where(eq(baziRecords.id, id)).limit(1)
    if (rows[0] && rows[0].userId === req.user.userId) {
      await db.delete(baziRecords).where(eq(baziRecords.id, id))
    }
    return { data: { success: true } }
  }
}
