import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Put, Req } from '@nestjs/common'
import { and, asc, eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '@/storage/database/db'
import { profiles } from '@/storage/database/schema'
import { ProfileDto, SyncProfilesDto } from './profile.dto'

@Controller('profile')
export class ProfileController {
  /** 我的档案列表（按创建时间升序） */
  @Get('list')
  async list(@Req() req: any) {
    const rows = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, req.user.userId))
      .orderBy(asc(profiles.createdAt))
    return { data: rows }
  }

  /** 新建档案 */
  @Post('create')
  @HttpCode(200)
  async create(@Req() req: any, @Body() body: ProfileDto) {
    const now = Date.now()
    const id = body?.id || uuidv4()
    await db.insert(profiles).values({
      id,
      userId: req.user.userId,
      nickname: body?.nickname || '',
      gender: body?.gender || '',
      birthDate: body?.birthDate || '',
      birthTime: body?.birthTime || '',
      location: body?.location || '',
      calendarType: body?.calendarType || '',
      stylePreference: body?.stylePreference || '',
      age: body?.age || null,
      isDefault: body?.isDefault ?? false,
      createdAt: now,
      updatedAt: now,
    })
    return { data: { id } }
  }

  /** 更新档案（仅允许更新本人档案，不存在或非本人返回 404） */
  @Put(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: ProfileDto) {
    const updateData: Record<string, unknown> = { updatedAt: Date.now() }
    const fields: (keyof ProfileDto)[] = [
      'nickname', 'gender', 'birthDate', 'birthTime', 'location',
      'calendarType', 'stylePreference', 'age', 'isDefault',
    ]
    for (const f of fields) {
      if (body?.[f] !== undefined) updateData[f] = body[f]
    }
    const rows = await db
      .update(profiles)
      .set(updateData)
      .where(and(eq(profiles.id, id), eq(profiles.userId, req.user.userId)))
      .returning({ id: profiles.id })
    if (!rows[0]) throw new NotFoundException('档案不存在')
    return { data: { success: true } }
  }

  /** 删除档案（仅允许删除本人档案，不存在或非本人返回 404） */
  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const rows = await db
      .delete(profiles)
      .where(and(eq(profiles.id, id), eq(profiles.userId, req.user.userId)))
      .returning({ id: profiles.id })
    if (!rows[0]) throw new NotFoundException('档案不存在')
    return { data: { success: true, deleted: true } }
  }

  /**
   * 档案同步（幂等 upsert）：前端本地档案全量推送到服务端。
   * 原子 upsert（INSERT ... ON CONFLICT DO UPDATE）避免并发主键冲突；
   * setWhere 限定冲突行必须属于当前用户，防止越权覆盖他人档案。
   */
  @Post('sync')
  @HttpCode(200)
  async sync(@Req() req: any, @Body() body: SyncProfilesDto) {
    const list = Array.isArray(body?.profiles) ? body.profiles.slice(0, 50) : []
    const now = Date.now()
    const syncedIds: string[] = []
    for (const p of list) {
      if (!p?.id) continue
      const rows = await db
        .insert(profiles)
        .values({
          id: p.id,
          userId: req.user.userId,
          nickname: p.nickname || '',
          gender: p.gender || '',
          birthDate: p.birthDate || '',
          birthTime: p.birthTime || '',
          location: p.location || '',
          calendarType: p.calendarType || '',
          stylePreference: p.stylePreference || '',
          age: p.age || null,
          isDefault: p.isDefault ?? false,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: profiles.id,
          set: {
            nickname: p.nickname || '',
            gender: p.gender || '',
            birthDate: p.birthDate || '',
            birthTime: p.birthTime || '',
            location: p.location || '',
            calendarType: p.calendarType || '',
            stylePreference: p.stylePreference || '',
            age: p.age || null,
            isDefault: p.isDefault ?? false,
            updatedAt: now,
          },
          // 冲突行不属于当前用户时不执行更新（静默跳过，防越权）
          setWhere: eq(profiles.userId, req.user.userId),
        })
        .returning({ id: profiles.id })
      if (rows[0]) syncedIds.push(rows[0].id)
    }
    return { data: { syncedIds, total: syncedIds.length } }
  }
}
