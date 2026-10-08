import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class PostChatDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: '안녕하세요', description: '채팅 내용' })
  public content: string;
}
