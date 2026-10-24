import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { DOC_TYPES } from '../../docs/dto/docs.dto';

export const TAB_ACCESS = ['none', 'view', 'edit'] as const;
export type TabAccess = (typeof TAB_ACCESS)[number];

export class AddChannelTabDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @ApiProperty({
    required: false,
    description: '탭으로 둘 문서 (newType 과 하나만)',
  })
  public docId?: number;

  @IsOptional()
  @IsIn(DOC_TYPES)
  @ApiProperty({
    required: false,
    enum: DOC_TYPES,
    description: '새로 만들어 탭으로 둘 문서 종류',
  })
  public newType?: (typeof DOC_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @ApiProperty({ required: false })
  public newTitle?: string;

  @IsOptional()
  @IsIn(TAB_ACCESS)
  @ApiProperty({
    required: false,
    enum: TAB_ACCESS,
    description:
      '채널 멤버에게 줄 권한 (새 문서는 기본 edit, 있는 문서는 기본 none)',
  })
  public access?: TabAccess;
}

export class UpdateChannelTabDto {
  @IsOptional()
  @IsIn(TAB_ACCESS)
  @ApiProperty({ required: false, enum: TAB_ACCESS })
  public access?: TabAccess;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({
    required: false,
    description: '댓글·수정·항목 변경을 채널에 알릴지',
  })
  public notify?: boolean;
}

export class ReorderChannelTabsDto {
  @IsArray()
  @ArrayMaxSize(20)
  @IsInt({ each: true })
  @ApiProperty({ type: [Number], description: '탭 id 를 보일 순서대로' })
  public ids: number[];
}
