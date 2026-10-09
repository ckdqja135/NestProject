import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateChannelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  // 채널 이름은 주소(URL 경로)에 그대로 쓰이므로 경로를 깨는 문자는 허용하지 않는다
  @Matches(/^[^/?#%\\]+$/, {
    message: '/, ?, #, %, \\ 는 채널 이름에 쓸 수 없습니다.',
  })
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
