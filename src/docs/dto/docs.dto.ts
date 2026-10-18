import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export const DOC_TYPES = ['doc', 'wiki', 'slides'] as const;
export const VISIBILITIES = ['private', 'workspace'] as const;
const MAX_CONTENT = 500_000;

export class DocListQuery {
  @IsOptional()
  @IsIn(['recent', 'mine', 'shared', 'favorites', 'trash', 'folder', 'all'])
  @ApiProperty({
    required: false,
    description:
      'recent(최근) mine(내 소유) shared(나와 공유) favorites(즐겨찾기) trash(휴지통) folder(폴더 안)',
  })
  public tab?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @ApiProperty({ required: false, description: '제목 검색' })
  public q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @ApiProperty({ required: false })
  public folderId?: number;
}

export class CreateDocDto {
  @IsIn(DOC_TYPES)
  @ApiProperty({ enum: DOC_TYPES })
  public type: 'doc' | 'wiki' | 'slides';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @ApiProperty({ required: false })
  public title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_CONTENT)
  @ApiProperty({ required: false, description: '처음 내용 (템플릿)' })
  public content?: string;

  @IsOptional()
  @IsIn(VISIBILITIES)
  @ApiProperty({ required: false, enum: VISIBILITIES })
  public visibility?: 'private' | 'workspace';

  @IsOptional()
  @IsInt()
  @ApiProperty({ required: false, description: '넣을 폴더 (내 폴더)' })
  public folderId?: number;

  @IsOptional()
  @IsInt()
  @ApiProperty({ required: false, description: '위키 상위 페이지' })
  public parentId?: number;
}

export class UpdateDocDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @ApiProperty({ required: false })
  public title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_CONTENT)
  @ApiProperty({ required: false })
  public content?: string;

  // 고치기 시작한 버전. 그 사이 다른 사람이 저장했으면 409
  @IsInt()
  @Min(1)
  @ApiProperty({ description: '고치기 시작한 버전' })
  public version: number;
}

export class DocSettingsDto {
  @IsOptional()
  @IsIn(VISIBILITIES)
  @ApiProperty({ required: false, enum: VISIBILITIES })
  public visibility?: 'private' | 'workspace';

  // null 이면 폴더 밖으로
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @ApiProperty({ required: false, nullable: true })
  public folderId?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @ApiProperty({ required: false, nullable: true })
  public parentId?: number | null;
}

export class DocShareDto {
  @IsInt()
  @ApiProperty()
  public userId: number;

  @IsIn(['view', 'edit'])
  @ApiProperty({ enum: ['view', 'edit'] })
  public role: 'view' | 'edit';
}

export class FolderDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  @ApiProperty({ required: false })
  public name?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @ApiProperty({ required: false, nullable: true })
  public parentId?: number | null;
}
