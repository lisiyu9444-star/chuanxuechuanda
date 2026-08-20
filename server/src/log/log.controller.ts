import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'

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

/**
 * 客户端日志上报接口。
 * 用于正式环境（无 vConsole）诊断端侧问题，日志写入服务 stdout 后可在线上运行日志中检索。
 */
@Controller('log')
export class LogController {
  @Post('client')
  @HttpCode(200)
  @SkipThrottle() // 日志上报不参与全局限流，避免诊断信息被拦截
  reportClientLog(@Body() body: ClientLogBody): { data: { ok: boolean } } {
    const tag = typeof body?.tag === 'string' ? body.tag : 'client'
    const level = body?.level ?? 'info'
    const message = typeof body?.message === 'string' ? body.message : ''
    let extraStr = ''
    try {
      extraStr = body?.extra ? ` ${JSON.stringify(body.extra)}` : ''
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
