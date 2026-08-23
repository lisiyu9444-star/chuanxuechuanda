import { IsOptional, IsString, Length } from 'class-validator'

/** 登录请求体（code 为 wx.login 返回的临时凭证） */
export class LoginDto {
  @IsString()
  @Length(1, 128)
  code!: string

  @IsOptional()
  @IsString()
  @Length(0, 64)
  nickname?: string

  @IsOptional()
  @IsString()
  @Length(0, 512)
  avatarUrl?: string
}

/** 更新用户资料 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(0, 64)
  nickname?: string

  @IsOptional()
  @IsString()
  @Length(0, 512)
  avatarUrl?: string
}

/** 隐私协议同意留痕 */
export class PrivacyConsentDto {
  @IsOptional()
  @IsString()
  @Length(1, 32)
  version?: string
}
