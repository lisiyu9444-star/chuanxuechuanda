import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Public } from '@/auth/public.decorator'
import { DAILY_LIMIT, FashionRatingService } from './fashion-rating.service'

/** multer 上传文件（memoryStorage 模式必有 buffer） */
interface UploadedImageFile {
  originalname: string
  mimetype: string
  size: number
  buffer?: Buffer
  path?: string
}

/**
 * AI 毒舌时尚官 - 穿搭评分接口。
 * 全部接口需登录（JwtAuthGuard 全局守卫，无 @Public 即需 Bearer token）。
 */
@Controller('fashion-rating')
export class FashionRatingController {
  constructor(private readonly fashionRatingService: FashionRatingService) {}

  /**
   * 上传穿搭照并评分（PRD 6.1）。
   * multipart 字段名：image；jpg/png/webp ≤10MB。
   * 返回 { data: { id, imageUrl, result, createdAt } }
   */
  @Post('rate')
  @HttpCode(200)
  @UseInterceptors(
    // 默认即为 memoryStorage（file.buffer 可直接读取），图片需上传 TOS 给大模型，不落盘
    FileInterceptor('image', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async rate(
    @UploadedFile() file: UploadedImageFile | undefined,
    @Req() req: any,
    @Headers() headers: Record<string, string>,
  ) {
    if (!file) {
      throw new BadRequestException('请先上传穿搭照片')
    }
    const userId = req.user?.userId as string
    // 客户端中断（前端 uploadFile task.abort / 页面退出）时取消 LLM 调用
    const abort = new AbortController()
    req.on('close', () => abort.abort())
    const data = await this.fashionRatingService.rate(userId, file, headers, abort.signal)
    return { data }
  }

  /** 今日剩余评分次数：{ data: { remaining, limit } } */
  @Get('remaining')
  async remaining(@Req() req: any) {
    const userId = req.user?.userId as string
    const remaining = await this.fashionRatingService.getRemaining(userId)
    return { data: { remaining, limit: DAILY_LIMIT } }
  }

  /** 我的测评记录（倒序）：{ data: { list } } */
  @Get('list')
  async list(@Req() req: any) {
    const userId = req.user?.userId as string
    const list = await this.fashionRatingService.list(userId)
    return { data: { list } }
  }

  /**
   * 分享场景查询单条测评记录（公开接口，好友打开分享卡片无需登录）。
   * 返回 { data: { id, imageUrl, result, createdAt } }，不存在时 404。
   */
  @Public()
  @Get('shared/:id')
  async shared(@Param('id') id: string) {
    const data = await this.fashionRatingService.getShared(id)
    if (!data) {
      throw new NotFoundException('测评记录不存在或已删除')
    }
    return { data }
  }

  /** 删除我的测评记录：{ data: { success } } */
  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.userId as string
    const success = await this.fashionRatingService.remove(userId, id)
    return { data: { success } }
  }
}
