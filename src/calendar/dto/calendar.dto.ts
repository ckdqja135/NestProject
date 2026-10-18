import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const EVENT_VISIBILITIES = ['public', 'private'] as const;
export const RSVP_STATUSES = ['accepted', 'declined'] as const;
// 가장 이른 알림: 7일 전
export const MAX_REMINDER_MINUTES = 7 * 24 * 60;

export class EventListQuery {
  @IsString()
  @ApiProperty({ description: '기간 시작 (ISO 8601)' })
  public from: string;

  @IsString()
  @ApiProperty({ description: '기간 끝 (ISO 8601, 포함하지 않음)' })
  public to: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    required: false,
    description: '같이 볼 사용자 id (쉼표로 구분). 없으면 나만',
  })
  public users?: string;
}

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @ApiProperty({ example: '주간 회의' })
  public title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  public description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @ApiProperty({ required: false, example: '3층 회의실' })
  public location?: string;

  @IsString()
  @ApiProperty({ description: '시작 (ISO 8601)' })
  public startAt: string;

  @IsString()
  @ApiProperty({ description: '끝 (ISO 8601, 종일 일정은 다음 날 0시)' })
  public endAt: string;

  @IsOptional()
  @IsBoolean()
  public allDay?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^(#[0-9a-fA-F]{6}|[a-z]{3,12})$/, {
    message: '색은 이름(blue 등)이나 #rrggbb 로 적어 주세요.',
  })
  public color?: string | null;

  @IsOptional()
  @IsIn(EVENT_VISIBILITIES)
  @ApiProperty({
    required: false,
    description:
      'public: 동료에게 제목까지 보임, private: 참석자 외에는 바쁨으로만',
  })
  public visibility?: 'public' | 'private';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  @ApiProperty({ required: false, type: [Number], description: '참석자 id' })
  public attendeeIds?: number[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_REMINDER_MINUTES)
  @ApiProperty({
    required: false,
    description: '시작 몇 분 전에 알릴지 (null: 알리지 않음)',
  })
  public reminderMinutes?: number | null;
}

export class UpdateEventDto extends PartialType(CreateEventDto) {}

export class RsvpDto {
  @IsIn(RSVP_STATUSES)
  @ApiProperty({ example: 'accepted', description: 'accepted | declined' })
  public status: 'accepted' | 'declined';
}
