import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateWorkspaceDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @ApiProperty({ example: '슐랙 팀', required: false, description: '새 이름' })
  public name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9-_]+$/, {
    message: 'url은 영문, 숫자, -, _ 만 사용할 수 있습니다.',
  })
  @ApiProperty({
    example: 'shlack-team',
    required: false,
    description: '새 url',
  })
  public url?: string;
}

export class TransferOwnerDto {
  @IsInt()
  @ApiProperty({ example: 2, description: '새 소유자 (워크스페이스 멤버)' })
  public userId: number;
}
