import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'isPublic'

/** 标记接口为公开接口，无需登录即可访问（配合全局 JwtAuthGuard） */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
