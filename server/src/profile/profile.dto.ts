import { Type } from 'class-transformer'
import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, Length, ValidateNested } from 'class-validator'

/** 档案字段（create/update/sync 共用，长度限制防滥用） */
export class ProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 64)
  id?: string

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
  @Length(0, 32)
  birthDate?: string

  @IsOptional()
  @IsString()
  @Length(0, 16)
  birthTime?: string

  @IsOptional()
  @IsString()
  @Length(0, 64)
  location?: string

  @IsOptional()
  @IsString()
  @Length(0, 16)
  calendarType?: string

  @IsOptional()
  @IsString()
  @Length(0, 64)
  stylePreference?: string

  @IsOptional()
  @IsString()
  @Length(0, 10)
  age?: string

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean
}

/** 批量同步请求体（单次最多 50 条） */
export class SyncProfilesDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ProfileDto)
  profiles?: ProfileDto[]
}
