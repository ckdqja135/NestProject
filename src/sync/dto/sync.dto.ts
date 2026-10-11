import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Matches, MaxLength, Min } from 'class-validator';

export class ReadMarkerDto {
  @IsString()
  @Matches(/^[cdt]:\d{1,10}$/, {
    message: 'key 는 c:채널id, d:사용자id, t:메시지id 형식입니다.',
  })
  @ApiProperty({
    example: 'c:3',
    description: 'c:채널id, d:상대 사용자id, t:스레드 원본 메시지id',
  })
  public key: string;

  @IsInt()
  @Min(0)
  @ApiProperty({ example: 1791700000000, description: '읽은 시각 (ms)' })
  public at: number;
}

export class DraftDto {
  @IsString()
  @Matches(/^(channel:[^\n]{1,30}|dm:\d{1,10})$/, {
    message: 'key 는 channel:채널이름 또는 dm:사용자id 형식입니다.',
  })
  @ApiProperty({ example: 'channel:일반' })
  public key: string;

  // 빈 문자열이면 지운다
  @IsString()
  @MaxLength(10000)
  @ApiProperty({ description: '쓰다 만 내용' })
  public content: string;

  @IsInt()
  @Min(0)
  @ApiProperty({ example: 1791700000000, description: '고친 시각 (ms)' })
  public at: number;
}
