import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  Max,
  Min,
  ValidateNested,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
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

  // 연락처 정보: 빈 문자열이나 null 이면 지운다
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @ApiProperty({ example: '디자인팀', required: false, description: '부서' })
  public department?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @ApiProperty({ example: '매니저', required: false, description: '직책' })
  public jobTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^[0-9+\-() ]*$/, {
    message: '전화번호는 숫자와 + - ( ) 만 쓸 수 있습니다.',
  })
  @ApiProperty({
    example: '010-1234-5678',
    required: false,
    description: '전화번호',
  })
  public phone?: string | null;
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

export const THEMES = ['system', 'light', 'dark'] as const;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class DndScheduleDto {
  @IsBoolean()
  @ApiProperty({ example: true, description: '켜기' })
  public on: boolean;

  @Matches(HHMM)
  @ApiProperty({ example: '22:00', description: '시작 (HH:mm)' })
  public start: string;

  @Matches(HHMM)
  @ApiProperty({
    example: '08:00',
    description: '끝 (HH:mm), 시작보다 이르면 다음 날',
  })
  public end: string;

  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @ApiProperty({ example: [1, 2, 3, 4, 5], description: '요일 0(일)~6(토)' })
  public days: number[];

  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_+\-/]+$/)
  @ApiProperty({ example: 'Asia/Seoul', description: '시간대' })
  public tz: string;
}

export class UpdatePreferencesDto {
  @IsOptional()
  @IsIn(THEMES)
  @ApiProperty({ required: false, enum: THEMES, description: '화면 테마' })
  public theme?: string;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ required: false, description: '데스크톱 알림 일시 중지' })
  public notificationsPaused?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => DndScheduleDto)
  @ApiProperty({
    required: false,
    nullable: true,
    description: '방해 금지 시간 (null 이면 지운다)',
  })
  public dndSchedule?: DndScheduleDto | null;
}

export class RequestPasswordResetDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @ApiProperty({ description: '가입한 이메일' })
  public email: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @ApiProperty({ description: '메일로 받은 링크의 토큰' })
  public token: string;

  @IsString()
  @MinLength(4)
  @MaxLength(100)
  @ApiProperty({ description: '새 비밀번호 (4자 이상)' })
  public password: string;
}
