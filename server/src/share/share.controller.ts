import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  NotFoundException,
} from '@nestjs/common'

interface SharedResult {
  id: string
  nickname: string
  gender: string
  dayMaster: string
  dayMasterElement: string
  fourPillars: Array<{
    name: string
    stem: string
    branch: string
    ganZhi: string
    stemElement: string
    branchElement: string
    naYin: string
    tenGod: string
  }>
  fiveElements: Array<{ name: string; count: number }>
  favorableElement: string
  favorableAnalysis: {
    dayMaster: string
    strength: string
    coreYongShen: string
    assistantXiShen: string
    taboo: string
    logicSummary: string
  }
  outfit: {
    style: string
    colors: string[]
    description: string
    prompt: string
  }
  imageUrl: string
  tryOnUrl?: string
  createdAt: number
}

// 内存存储（生产环境建议使用数据库）
const sharedResults = new Map<string, SharedResult>()

@Controller('share')
export class ShareController {
  @Post('save')
  @HttpCode(200)
  async saveResult(@Body() body: Omit<SharedResult, 'id' | 'createdAt'>) {
    const id = this.generateId()
    const result: SharedResult = {
      ...body,
      id,
      createdAt: Date.now(),
    }
    sharedResults.set(id, result)
    
    // 清理过期数据（超过 24 小时的）
    this.cleanupExpiredData()
    
    return { data: { shareId: id } }
  }

  @Get(':id')
  @HttpCode(200)
  async getResult(@Param('id') id: string) {
    const result = sharedResults.get(id)
    if (!result) {
      throw new NotFoundException('分享结果不存在或已过期')
    }
    return { data: result }
  }

  private generateId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  private cleanupExpiredData() {
    const now = Date.now()
    const expiryTime = 24 * 60 * 60 * 1000 // 24 小时
    
    for (const [id, result] of sharedResults.entries()) {
      if (now - result.createdAt > expiryTime) {
        sharedResults.delete(id)
      }
    }
  }
}
