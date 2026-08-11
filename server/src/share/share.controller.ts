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
} from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { db } from '../storage/database/db'
import { shares } from '../storage/database/schema'

interface SharedResult {
  nickname: string
  gender: string
  result: any
  imageUrl?: string
  tryOnUrl?: string
  createdAt: number
  expiresAt: number
}

@Controller('share')
export class ShareController {
  private readonly logger = new Logger(ShareController.name)

  @Post('save')
  @HttpCode(HttpStatus.OK)
  async saveShare(@Body() body: { nickname: string; gender: string; result: any; imageUrl?: string; tryOnUrl?: string }) {
    const shareId = `share_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const now = Date.now()
    const expiresAt = now + 180 * 24 * 60 * 60 * 1000

    const shareData = {
      id: shareId,
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
      this.logger.error('Failed to save share', error)
      throw error
    }
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async updateShare(
    @Param('id') id: string,
    @Body() body: { nickname: string; gender: string; result: any; imageUrl?: string; tryOnUrl?: string },
  ) {
    const now = Date.now()
    const expiresAt = now + 180 * 24 * 60 * 60 * 1000

    const updateData = {
      nickname: body.nickname,
      gender: body.gender || 'male',
      result: JSON.stringify(body.result),
      imageUrl: body.imageUrl || null,
      tryOnUrl: body.tryOnUrl || null,
      expiresAt: expiresAt,
    }

    try {
      const result = await db.update(shares).set(updateData).where(eq(shares.id, id))
      this.logger.log(`Share updated: ${id}`)
      return { success: true }
    } catch (error) {
      this.logger.error('Failed to update share', error)
      throw error
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

      const result = JSON.parse(share.result)

      return {
        result: {
          ...result,
          outfit: result.outfit || result.outfitResult,
        },
        tryOnUrl: share.tryOnUrl,
      }
    } catch (error) {
      this.logger.error('Failed to get share', error)
      throw error
    }
  }
}
