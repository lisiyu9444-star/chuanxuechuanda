import { Controller, Post, Get, Put, Body, Param, HttpException, HttpStatus } from '@nestjs/common'
import db from '../database'

interface SharedResult {
  id: string
  nickname: string
  gender: string
  result: string  // JSON 字符串，包含完整的 result 对象
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
    result: any  // 完整的 result 对象
    tryOnUrl?: string
  }) {
    try {
      const id = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const now = Date.now()
      const expiresAt = now + 180 * 24 * 60 * 60 * 1000 // 180 天过期

      const stmt = db.prepare(`
        INSERT INTO shares (id, nickname, gender, result, tryOnUrl, createdAt, expiresAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run(
        id,
        body.nickname,
        body.gender,
        JSON.stringify(body.result),
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
    @Body() body: {
      nickname?: string
      gender?: string
      result?: any
      tryOnUrl?: string
    }
  ) {
    try {
      // 构建动态更新语句
      const updates: string[] = []
      const values: any[] = []

      if (body.nickname !== undefined) {
        updates.push('nickname = ?')
        values.push(body.nickname)
      }
      if (body.gender !== undefined) {
        updates.push('gender = ?')
        values.push(body.gender)
      }
      if (body.result !== undefined) {
        updates.push('result = ?')
        values.push(JSON.stringify(body.result))
      }
      if (body.tryOnUrl !== undefined) {
        updates.push('tryOnUrl = ?')
        values.push(body.tryOnUrl)
      }

      if (updates.length === 0) {
        return {
          code: 200,
          data: { success: true },
          msg: '无需更新'
        }
      }

      values.push(id)
      const stmt = db.prepare(`UPDATE shares SET ${updates.join(', ')} WHERE id = ?`)
      const result = stmt.run(...values)

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
        SELECT * FROM shares WHERE id = ?
      `)

      const share = stmt.get(id) as SharedResult | undefined

      if (!share) {
        return {
          code: 200,
          data: { expired: true },
          msg: '分享不存在或已过期'
        }
      }

      // 检查是否过期
      if (share.expiresAt < Date.now()) {
        return {
          code: 200,
          data: { expired: true },
          msg: '分享已过期'
        }
      }

      // 解析 result
      let result = null
      try {
        result = share.result ? JSON.parse(share.result) : null
      } catch (e) {
        console.error('[Share] Failed to parse result:', e)
      }

      return {
        code: 200,
        data: {
          result: result,
          tryOnUrl: share.tryOnUrl
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
