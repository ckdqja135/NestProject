import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

// 그림은 base64 data URL (약 128KB 이하)
export const MAX_IMAGE_LENGTH = 180_000;

export class CreateEmojiDto {
  // :이름: 이 리액션 칸(16자)에 들어가도록 14자까지
  @IsString()
  @Matches(/^[a-z0-9_-]{1,14}$/, {
    message:
      '이모지 이름은 영문 소문자, 숫자, _, - 로 14자까지 쓸 수 있습니다.',
  })
  @ApiProperty({
    example: 'party_parrot',
    description: ':party_parrot: 으로 쓴다',
  })
  public name: string;

  @IsString()
  @MaxLength(MAX_IMAGE_LENGTH, { message: '그림이 너무 큽니다. (128KB 이하)' })
  @Matches(/^data:image\/(png|gif|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/, {
    message: 'PNG, GIF, JPEG, WEBP 그림만 쓸 수 있습니다.',
  })
  @ApiProperty({ description: 'data:image/png;base64,...' })
  public image: string;
}
