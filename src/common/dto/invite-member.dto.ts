import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class InviteMemberDto {
  @IsEmail()
  @ApiProperty({ example: 'ckdqja135@gmail.com', description: '초대할 사용자 이메일' })
  public email: string;
}
