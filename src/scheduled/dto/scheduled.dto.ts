import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateScheduledDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @ApiProperty({ required: false, description: '채널 이름 (채널로 보낼 때)' })
  public channel?: string;

  @IsOptional()
  @IsInt()
  @ApiProperty({
    required: false,
    description: 'DM 받는 사람 id (DM 으로 보낼 때)',
  })
  public receiverId?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  @ApiProperty({ description: '보낼 내용' })
  public content: string;

  @IsDateString()
  @ApiProperty({
    example: '2026-10-11T09:00:00.000Z',
    description: '보낼 시각',
  })
  public sendAt: string;
}

export class CreateReminderDto {
  @IsOptional()
  @IsInt()
  @ApiProperty({ required: false, description: '채널 메시지 id' })
  public chatId?: number;

  @IsOptional()
  @IsInt()
  @ApiProperty({ required: false, description: 'DM id' })
  public dmId?: number;

  @IsDateString()
  @ApiProperty({
    example: '2026-10-11T09:00:00.000Z',
    description: '알릴 시각',
  })
  public remindAt: string;
}
