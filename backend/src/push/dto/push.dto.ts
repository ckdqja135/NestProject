import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, MaxLength, ValidateNested } from 'class-validator';

class PushKeysDto {
  @IsString()
  @MaxLength(200)
  @ApiProperty({ description: '브라우저가 준 공개 키' })
  public p256dh: string;

  @IsString()
  @MaxLength(100)
  @ApiProperty({ description: '브라우저가 준 인증 값' })
  public auth: string;
}

export class PushSubscriptionDto {
  @IsString()
  @MaxLength(500)
  @ApiProperty({ description: '브라우저 회사 푸시 서버 주소' })
  public endpoint: string;

  @ValidateNested()
  @Type(() => PushKeysDto)
  @ApiProperty({ type: PushKeysDto })
  public keys: PushKeysDto;
}

export class PushUnsubscribeDto {
  @IsString()
  @MaxLength(500)
  @ApiProperty({ description: '지울 구독의 주소' })
  public endpoint: string;
}
