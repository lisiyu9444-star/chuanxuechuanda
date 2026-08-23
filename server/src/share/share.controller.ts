import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  Req,
} from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { Headers } from '@nestjs/common'
import { db } from '../storage/database/db'
import { shares } from '../storage/database/schema'
import { signUrl } from '../assets/tos-utils'
import { Public } from '../auth/public.decorator'
import { RequireAuth } from '../auth/require-auth.decorator'
import { AuthService } from '../auth/auth.service'

// 分享查看页可能被未登录访客打开，整个控制器保持公开；
// save 时若携带有效 token 则关联 userId，便于后续统计。
@Public()
@Controller('share')
export class ShareController {
  private readonly logger = new Logger(ShareController.name)

  constructor(private readonly authService: AuthService) {}

  @Post('save')
  @HttpCode(HttpStatus.OK)
  async saveShare(
    @Body() body: { nickname: string; gender: string; result: any; imageUrl?: string; tryOnUrl?: string },
    @Headers('authorization') authorization?: string,
  ) {
    const shareId = `share_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const now = Date.now()
    const expiresAt = now + 180 * 24 * 60 * 60 * 1000

    if (!body.result) {
      throw new BadRequestException('Result is required')
    }

    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
    const authUser = token ? await this.authService.verifyTokenOptional(token) : null

    const shareData = {
      id: shareId,
      userId: authUser?.userId || null,
      nickname: body.nickname,
      gender: body.gender || 'male',
      result: JSON.stringify(body.result),
      imageUrl: body.imageUrl || null,
      tryOnUrl: body.tryOnUrl || null,
      createdAt: now,
      expiresAt: expiresAt,
    }

    try {
      await db.insert(shares).values(shareData)
      this.logger.log(`Share created: ${shareId}`)
      return { shareId }
    } catch (error) {
      // 数据库错误细节只进服务端日志，对外脱敏
      this.logger.error('Failed to save share', error)
      throw new InternalServerErrorException('保存分享失败')
    }
  }

  /**
   * 更新分享内容：必须登录，且仅允许更新本人创建的分享。
   * 匿名分享（userId 为空）创建后不可变，前端更新失败应降级为重新创建。
   */
  @RequireAuth()
  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async updateShare(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { nickname: string; gender: string; result: any; imageUrl?: string; tryOnUrl?: string },
  ) {
    const now = Date.now()
    const expiresAt = now + 180 * 24 * 60 * 60 * 1000

    if (!body.result) {
      throw new BadRequestException('result is required')
    }

    let existing: (typeof shares.$inferSelect) | undefined
    try {
      const rows = await db.select().from(shares).where(eq(shares.id, id)).limit(1)
      existing = rows[0]
    } catch (error) {
      this.logger.error('Failed to load share', error)
      throw new InternalServerErrorException('更新分享失败')
    }
    if (!existing) throw new NotFoundException('分享不存在')
    if (!existing.userId || existing.userId !== req.user?.userId) {
      throw new ForbiddenException('无权修改该分享')
    }

    const updateData = {
      nickname: body.nickname,
      gender: body.gender || 'male',
      result: JSON.stringify(body.result),
      imageUrl: body.imageUrl || null,
      tryOnUrl: body.tryOnUrl || null,
      expiresAt: expiresAt,
    }

    try {
      await db.update(shares).set(updateData).where(eq(shares.id, id))
      this.logger.log(`Share updated: ${id}`)
      return { success: true }
    } catch (error) {
      this.logger.error('Failed to update share', error)
      throw new InternalServerErrorException('更新分享失败')
    }
  }

  @Get(':id')
  async getShare(@Param('id') id: string) {
    try {
      const results = await db.select().from(shares).where(eq(shares.id, id)).limit(1)

      if (results.length === 0) {
        return { expired: true }
      }

      const share = results[0]

      if (Date.now() > share.expiresAt) {
        return { expired: true }
      }

      let result
      try {
        result = JSON.parse(share.result || '{}')
      } catch {
        result = {}
      }

      // 签名 URL 有有效期，读取时对本 bucket 的图片重新换签，避免 180 天分享期内图片过期
      const [imageUrl, tryOnUrl, resultImageUrl] = await Promise.all([
        signUrl(share.imageUrl || undefined),
        signUrl(share.tryOnUrl || undefined),
        signUrl(result.imageUrl || undefined),
      ])

      return {
        result: {
          ...result,
          outfit: result.outfit || result.outfitResult,
          imageUrl: resultImageUrl || result.imageUrl,
        },
        imageUrl: imageUrl || share.imageUrl,
        tryOnUrl: tryOnUrl || share.tryOnUrl,
      }
    } catch (error) {
      this.logger.error('Failed to get share', error)
      throw error
    }
  }
}
