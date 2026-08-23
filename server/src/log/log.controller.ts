import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { Public } from '@/auth/public.decorator'

interface ClientLogBody {
  /** 日志来源标签，如 rewarded-ad */
  tag?: string
  /** 日志级别 */
  level?: 'info' | 'warn' | 'error'
  /** 日志消息 */
  message?: string
  /** 附加上下文（错误码、广告位 ID 等） */
  extra?: Record<string, unknown>
}

const MAX_TAG_LEN = 64
const MAX_MESSAGE_LEN = 2000
const MAX_EXTRA_LEN = 4000

/** 去除换行/控制字符，防止伪造日志行（日志注入） */
const sanitize = (input: string, maxLen: number): string =>
  input.replace(/[\r\n\t]+/g, ' ').slice(0, maxLen)

/**
 * 客户端日志上报接口。
 * 用于正式环境（无 vConsole）诊断端侧问题，日志写入服务 stdout 后可在线上运行日志中检索。
 * 公开接口但限流（30 次/分钟），内容做长度截断与换行清洗，防止刷爆日志存储。
 */
@Public()
@Controller('log')
export class LogController {
  @Post('client')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  reportClientLog(@Body() body: ClientLogBody): { data: { ok: boolean } } {
    const tag = sanitize(typeof body?.tag === 'string' ? body.tag : 'client', MAX_TAG_LEN)
    const level = body?.level === 'warn' || body?.level === 'error' ? body.level : 'info'
    const message = sanitize(typeof body?.message === 'string' ? body.message : '', MAX_MESSAGE_LEN)
    let extraStr = ''
    try {
      extraStr = body?.extra ? ` ${sanitize(JSON.stringify(body.extra), MAX_EXTRA_LEN)}` : ''
    } catch {
      extraStr = ' [extra unserializable]'
    }
    const line = `[ClientLog][${tag}][${level}] ${message}${extraStr}`
    if (level === 'error') {
      console.error(line)
    } else if (level === 'warn') {
      console.warn(line)
    } else {
      console.log(line)
    }
    return { data: { ok: true } }
  }
}
