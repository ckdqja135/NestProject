import { ApiProperty } from '@nestjs/swagger';
import {
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
