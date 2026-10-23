import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { MAX_FORWARD_COMMENT } from './forward.service';

export class ForwardDto {
  @IsIn(['chat', 'dm'])
  @ApiProperty({ enum: ['chat', 'dm'], description: '원본 종류' })
  public source: 'chat' | 'dm';

  @Type(() => Number)
  @IsInt()
  @ApiProperty({ description: '원본 메시지 id' })
  public id: number;

  @IsIn(['channel', 'dm'])
  @ApiProperty({ enum: ['channel', 'dm'], description: '보낼 곳 종류' })
  public to: 'channel' | 'dm';

  @ValidateIf((o) => o.to === 'channel')
  @IsString()
  @MaxLength(80)
  @ApiProperty({ description: '채널 이름 또는 DM 상대 id' })
  public target: string | number;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_FORWARD_COMMENT)
  @ApiProperty({ required: false, description: '덧붙일 말' })
  public comment?: string;
}
