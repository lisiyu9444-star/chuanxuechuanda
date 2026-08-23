import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Req } from '@nestjs/common'
import { asc, eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '@/storage/database/db'
import { profiles } from '@/storage/database/schema'

interface ProfileBody {
  id?: string
  nickname?: string
  gender?: string
  birthDate?: string
  birthTime?: string
  location?: string
  calendarType?: string
  stylePreference?: string
  age?: string
  isDefault?: boolean
}

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
  async create(@Req() req: any, @Body() body: ProfileBody) {
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

  /** 更新档案（仅允许更新本人档案） */
  @Put(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: ProfileBody) {
    const updateData: Record<string, unknown> = { updatedAt: Date.now() }
    const fields: (keyof ProfileBody)[] = [
      'nickname', 'gender', 'birthDate', 'birthTime', 'location',
      'calendarType', 'stylePreference', 'age', 'isDefault',
    ]
    for (const f of fields) {
      if (body?.[f] !== undefined) updateData[f] = body[f]
    }
    await db
      .update(profiles)
      .set(updateData)
      .where(eq(profiles.id, id))
    return { data: { success: true } }
  }

  /** 删除档案（仅允许删除本人档案） */
  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const rows = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1)
    if (rows[0] && rows[0].userId === req.user.userId) {
      await db.delete(profiles).where(eq(profiles.id, id))
    }
    return { data: { success: true } }
  }

  /** 档案同步（幂等 upsert）：前端本地档案全量推送到服务端 */
  @Post('sync')
  @HttpCode(200)
  async sync(@Req() req: any, @Body() body: { profiles?: ProfileBody[] }) {
    const list = Array.isArray(body?.profiles) ? body.profiles : []
    const now = Date.now()
    const syncedIds: string[] = []
    for (const p of list) {
      if (!p?.id) continue
      const existing = await db.select().from(profiles).where(eq(profiles.id, p.id)).limit(1)
      if (existing.length > 0) {
        if (existing[0].userId !== req.user.userId) continue
        await db
          .update(profiles)
          .set({
            nickname: p.nickname ?? existing[0].nickname,
            gender: p.gender ?? existing[0].gender,
            birthDate: p.birthDate ?? existing[0].birthDate,
            birthTime: p.birthTime ?? existing[0].birthTime,
            location: p.location ?? existing[0].location,
            calendarType: p.calendarType ?? existing[0].calendarType,
            stylePreference: p.stylePreference ?? existing[0].stylePreference,
            age: p.age ?? existing[0].age,
            isDefault: p.isDefault ?? existing[0].isDefault,
            updatedAt: now,
          })
          .where(eq(profiles.id, p.id))
      } else {
        await db.insert(profiles).values({
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
      }
      syncedIds.push(p.id)
    }
    return { data: { syncedIds, total: syncedIds.length } }
  }
}
