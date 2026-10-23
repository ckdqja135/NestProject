import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
} from 'class-validator';

export const MEMBER_ROLES = ['admin', 'member', 'guest'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export class InviteWorkspaceMemberDto {
  @IsEmail()
  @ApiProperty({
    example: 'ckdqja135@gmail.com',
    description: '초대할 사용자 이메일',
  })
  public email: string;

  @IsOptional()
  @IsIn(['member', 'guest'])
  @ApiProperty({
    example: 'member',
    required: false,
    description:
      'member(기본) 또는 guest(초대한 채널만 보는 외부 사람, 관리자만)',
  })
  public role?: 'member' | 'guest';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  @ApiProperty({
    example: [3],
    required: false,
    description: '게스트가 들어갈 채널 id (게스트일 때 하나 이상)',
  })
  public channelIds?: number[];
}

export class SetMemberRoleDto {
  @IsIn(MEMBER_ROLES)
  @ApiProperty({ example: 'admin', description: 'admin · member · guest' })
  public role: MemberRole;
}
