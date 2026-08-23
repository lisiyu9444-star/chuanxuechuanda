import { IsOptional, IsString, Length } from 'class-validator'

/** 历史记录保存请求体（result 为完整 HistoryRecord JSON，限制 200KB 防撑爆数据库） */
export class SaveRecordDto {
  /** 前端本地记录 id（幂等键）：同用户 + clientId 已存在时执行更新而非新增 */
  @IsOptional()
  @IsString()
  @Length(1, 128)
  clientId?: string

  @IsOptional()
  @IsString()
  @Length(0, 64)
  profileId?: string

  @IsOptional()
  @IsString()
  @Length(0, 20)
  type?: string

  @IsOptional()
  @IsString()
  @Length(0, 64)
  nickname?: string

  @IsOptional()
  @IsString()
  @Length(0, 16)
  gender?: string

  @IsOptional()
  @IsString()
  @Length(0, 204800)
  result?: string

  @IsOptional()
  @IsString()
  @Length(0, 1024)
  imageUrl?: string

  @IsOptional()
  @IsString()
  @Length(0, 1024)
  tryOnUrl?: string

  @IsOptional()
  @IsString()
  @Length(0, 102400)
  llmPlan?: string

  @IsOptional()
  @IsString()
  @Length(0, 10240)
  luckyScore?: string
}
