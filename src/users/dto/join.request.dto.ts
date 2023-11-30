import { ApiProperty } from '@nestjs/swagger';

export class JoinRequestDto {
  @ApiProperty({
    example: 'ckdqja135@gmail.com',
    description: '이메일',
  })
  public email: string;

  @ApiProperty({
    example: 'changbami',
    description: '닉네임',
  })
  public nickname: string;

  @ApiProperty({
    example: '1234',
    description: '비밀번호',
  })
  public password: string;
}
