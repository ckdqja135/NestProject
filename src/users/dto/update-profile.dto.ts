import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// Gravatar 기본 이미지 종류 (https://docs.gravatar.com/general/images/)
export const AVATAR_STYLES = [
  'retro',
  'identicon',
  'monsterid',
  'wavatar',
  'robohash',
  'mp',
] as const;

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @ApiProperty({ example: '창범', required: false, description: '닉네임' })
  public nickname?: string;

  @IsOptional()
  @IsIn(AVATAR_STYLES)
  @ApiProperty({
    example: 'identicon',
    required: false,
    enum: AVATAR_STYLES,
    description: '아바타 스타일',
  })
  public avatarStyle?: string;

  // 상태 메시지: 빈 문자열이나 null 이면 지운다
  @IsOptional()
  @IsString()
  @MaxLength(16)
  @ApiProperty({ example: '🗓️', required: false, description: '상태 이모지' })
  public statusEmoji?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @ApiProperty({
    example: '회의 중',
    required: false,
    description: '상태 메시지',
  })
  public statusText?: string | null;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ required: false, description: '자리 비움으로 표시' })
  public away?: boolean;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: '현재 비밀번호' })
  public currentPassword: string;

  @IsString()
  @MinLength(4)
  @MaxLength(100)
  @ApiProperty({ description: '새 비밀번호 (4자 이상)' })
  public newPassword: string;
}
