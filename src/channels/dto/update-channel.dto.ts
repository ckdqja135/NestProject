import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateChannelDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  // 채널 이름은 주소(URL 경로)에 그대로 쓰이므로 경로를 깨는 문자는 허용하지 않는다
  @Matches(/^[^/?#%\\]+$/, {
    message: '/, ?, #, %, \\ 는 채널 이름에 쓸 수 없습니다.',
  })
  @ApiProperty({
    example: '공지',
    required: false,
    description: '새 채널 이름',
  })
  public name?: string;

  // 빈 문자열이나 null 이면 주제를 지운다
  @IsOptional()
  @IsString()
  @MaxLength(250)
  @ApiProperty({
    example: '이번 주 배포 이야기',
    required: false,
    description: '채널 주제',
  })
  public topic?: string | null;
}
