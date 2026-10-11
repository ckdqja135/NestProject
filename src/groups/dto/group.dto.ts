import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// 멘션 표기(@[이름](g1))와 겹치지 않도록 공백·괄호·@ 는 쓸 수 없다
const NAME = /^[^\s@()[\]]+$/;

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Matches(NAME, { message: '그룹 이름에는 공백, @, 괄호를 쓸 수 없습니다.' })
  @ApiProperty({
    example: '디자인팀',
    description: '그룹 이름 (@디자인팀 으로 멘션)',
  })
  public name: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @ApiProperty({ required: false, description: '설명' })
  public description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  @ApiProperty({ required: false, description: '멤버 id 목록' })
  public memberIds?: number[];
}

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Matches(NAME, { message: '그룹 이름에는 공백, @, 괄호를 쓸 수 없습니다.' })
  @ApiProperty({ required: false })
  public name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @ApiProperty({ required: false })
  public description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  @ApiProperty({ required: false, description: '멤버 id 목록 (통째로 바꾼다)' })
  public memberIds?: number[];
}
