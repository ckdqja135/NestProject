import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const APPROVAL_KINDS = [
  'general',
  'leave',
  'expense',
  'purchase',
] as const;

export class CreateApprovalDto {
  @IsIn(APPROVAL_KINDS)
  @ApiProperty({ enum: APPROVAL_KINDS, description: '일반·휴가·지출·구매' })
  public kind: (typeof APPROVAL_KINDS)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @ApiProperty({ example: '노트북 구매' })
  public title: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @ApiProperty({ required: false, description: '자세한 내용' })
  public body?: string;

  @IsOptional()
  @IsObject()
  @ApiProperty({
    required: false,
    description:
      '종류별 칸 (예: { "start": "2026-11-02", "end": "2026-11-03" } · { "amount": "1500000" })',
  })
  public fields?: Record<string, string>;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsInt({ each: true })
  @ApiProperty({ example: [6, 7], description: '결재자 (순서대로)' })
  public approverIds: number[];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @ApiProperty({ required: false, description: '카드를 올릴 채널 이름' })
  public channel?: string;

  @IsOptional()
  @IsInt()
  @ApiProperty({
    required: false,
    description: '카드를 올릴 DM 상대 (채널 대신)',
  })
  public dmUserId?: number;
}

export class DecideApprovalDto {
  @IsIn(['approve', 'reject'])
  @ApiProperty({ enum: ['approve', 'reject'] })
  public decision: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ApiProperty({ required: false, description: '의견 (반려 사유 등)' })
  public comment?: string;
}
