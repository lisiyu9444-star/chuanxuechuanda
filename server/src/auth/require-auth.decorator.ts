import { SetMetadata } from '@nestjs/common'

export const REQUIRE_AUTH_KEY = 'requireAuth'

/**
 * 在类级 @Public() 的控制器中，强制某个方法必须登录。
 * 用于「整体公开但个别写操作需鉴权」的场景（如分享更新）。
 */
export const RequireAuth = () => SetMetadata(REQUIRE_AUTH_KEY, true)
