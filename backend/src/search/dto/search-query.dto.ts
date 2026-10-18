import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class SearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @ApiProperty({ required: false, description: '검색어' })
  public q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @ApiProperty({
    required: false,
    description: '이 채널에서만 (채널 이름). 지정하면 DM 은 제외',
  })
  public channel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @ApiProperty({ required: false, description: '보낸 사람 id' })
  public from?: number;

  @IsOptional()
  @Matches(DATE, { message: 'after 는 YYYY-MM-DD 형식이어야 합니다.' })
  @ApiProperty({ required: false, description: '이 날짜부터 (YYYY-MM-DD)' })
  public after?: string;

  @IsOptional()
  @Matches(DATE, { message: 'before 는 YYYY-MM-DD 형식이어야 합니다.' })
  @ApiProperty({ required: false, description: '이 날짜까지 (YYYY-MM-DD)' })
  public before?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @ApiProperty({ required: false, description: '페이지 (1부터)' })
  public page?: number;

  // 브라우저의 new Date().getTimezoneOffset() (분). 기간 필터의 하루 경계를 사용자 시간대로 계산한다
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-840)
  @Max(840)
  @ApiProperty({
    required: false,
    example: -540,
    description: '시간대 (UTC 와의 차이, 분)',
  })
  public tz?: number;
}
