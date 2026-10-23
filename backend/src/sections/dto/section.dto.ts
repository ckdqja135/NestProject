import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSectionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  @ApiProperty({ example: '프로젝트', description: '섹션 이름' })
  public name: string;
}

export class UpdateSectionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  @ApiProperty({ required: false, example: '거래처' })
  public name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiProperty({ required: false, example: 0, description: '순서 (0 부터)' })
  public position?: number;
}
