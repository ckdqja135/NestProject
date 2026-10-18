import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateWebhookDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  @ApiProperty({
    example: 'GitHub',
    description: '메시지에 보일 보낸 사람 이름',
  })
  public name: string;
}

// Slack 수신 웹훅과 같은 형식 ({ "text": "..." })
export class IncomingWebhookDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  @ApiProperty({
    example: '배포가 끝났습니다 🚀',
    description: '보낼 내용 (마크다운)',
  })
  public text: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @ApiProperty({ required: false, description: '이번 메시지만 다른 이름으로' })
  public username?: string;
}
