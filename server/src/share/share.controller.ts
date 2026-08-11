import { Controller, Post, Get, Put, Body, Param, HttpException, HttpStatus } from '@nestjs/common'
import db from '../database'

interface SharedResult {
  id: string
  nickname: string
  gender: string
  outfitResult: string
  imageUrl: string
  tryOnUrl?: string
  createdAt: number
  expiresAt: number
}

@Controller('share')
export class ShareController {
  // 创建分享
  @Post('save')
  saveShare(@Body() body: {
    nickname: string
    gender: string
    outfitResult: string
    imageUrl: string
    tryOnUrl?: string
  }) {
    try {
      const id = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const now = Date.now()
      const expiresAt = now + 30 * 24 * 60 * 60 * 1000 // 30 天过期

      const stmt = db.prepare(`
        INSERT INTO shares (id, nickname, gender, outfitResult, imageUrl, tryOnUrl, createdAt, expiresAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run(
        id,
        body.nickname,
        body.gender,
        body.outfitResult,
        body.imageUrl,
        body.tryOnUrl || null,
        now,
        expiresAt
      )

      return {
        code: 200,
        data: { shareId: id },
        msg: '保存成功'
      }
    } catch (error) {
      console.error('[Share] Save error:', error)
      throw new HttpException('保存失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  // 更新分享（用于更新上身图）
  @Put(':id')
  updateShare(
    @Param('id') id: string,
    @Body() body: { tryOnUrl: string }
  ) {
    try {
      const stmt = db.prepare(`
        UPDATE shares SET tryOnUrl = ? WHERE id = ?
      `)

      const result = stmt.run(body.tryOnUrl, id)

      if (result.changes === 0) {
        throw new HttpException('分享不存在', HttpStatus.NOT_FOUND)
      }

      return {
        code: 200,
        data: { success: true },
        msg: '更新成功'
      }
    } catch (error) {
      console.error('[Share] Update error:', error)
      if (error instanceof HttpException) throw error
      throw new HttpException('更新失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  // 获取分享
  @Get(':id')
  getShare(@Param('id') id: string) {
    try {
      const stmt = db.prepare(`
        SELECT * FROM shares WHERE id = ? AND expiresAt > ?
      `)

      const share = stmt.get(id, Date.now()) as SharedResult | undefined

      if (!share) {
        throw new HttpException('分享不存在或已过期', HttpStatus.NOT_FOUND)
      }

      // 组装前端期望的数据结构
      const result = {
        nickname: share.nickname,
        gender: share.gender,
        outfit: share.outfitResult ? JSON.parse(share.outfitResult) : null,
        imageUrl: share.imageUrl,
      }

      return {
        code: 200,
        data: {
          result,
          tryOnUrl: share.tryOnUrl || null,
        },
        msg: '获取成功'
      }
    } catch (error) {
      console.error('[Share] Get error:', error)
      if (error instanceof HttpException) throw error
      throw new HttpException('获取失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }
}
