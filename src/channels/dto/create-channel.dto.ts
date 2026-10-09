import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateChannelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @ApiProperty({ example: '자유', description: '채널명' })
  public name: string;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({
    example: false,
    required: false,
    description: '비공개 채널 여부 (초대받은 사람만 참여 가능)',
  })
  public private?: boolean;
}
