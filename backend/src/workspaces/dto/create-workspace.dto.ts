import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class CreateWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @ApiProperty({ example: '슐랙', description: '워크스페이스명' })
  public workspace: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9-_]+$/, {
    message: 'url은 영문, 숫자, -, _ 만 사용할 수 있습니다.',
  })
  @ApiProperty({ example: 'shlack', description: 'url 주소' })
  public url: string;
}
