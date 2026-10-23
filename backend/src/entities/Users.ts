import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ChannelChats } from './ChannelChats';
import { ChannelMembers } from './ChannelMembers';
import { DMs } from './DMs';
import { Mentions } from './Mentions';
import { WorkspaceMembers } from './WorkspaceMembers';
import { Workspaces } from './Workspaces';

@Index('email', ['email'], { unique: true })
@Entity({ name: 'users' })
export class Users {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @IsEmail()
  @ApiProperty({
    example: 'ckdqja135@gmail.com',
    description: '이메일',
  })
  @Column('varchar', { name: 'email', unique: true, length: 30 })
  email: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'changbami',
    description: '닉네임',
  })
  @Column('varchar', { name: 'nickname', length: 30 })
  nickname: string;

  // 아바타 스타일 (Gravatar 기본 이미지 종류). 이미지 파일을 서버에 올리지 않는다.
  @Column('varchar', { name: 'avatarStyle', length: 20, nullable: true })
  avatarStyle: string | null;

  // 상태 메시지 (예: 🗓️ 회의 중)
  @Column('varchar', { name: 'statusEmoji', length: 16, nullable: true })
  statusEmoji: string | null;

  @Column('varchar', { name: 'statusText', length: 100, nullable: true })
  statusText: string | null;

  // 연락처 정보 (워크스페이스 멤버끼리 연락처 화면에서 본다)
  @Column('varchar', { name: 'department', length: 40, nullable: true })
  department: string | null;

  @Column('varchar', { name: 'jobTitle', length: 40, nullable: true })
  jobTitle: string | null;

  @Column('varchar', { name: 'phone', length: 30, nullable: true })
  phone: string | null;

  // 자리 비움으로 표시 (접속 중이어도 온라인 표시를 흐리게)
  @Column('boolean', { name: 'away', default: false })
  away: boolean;

  // 화면 테마 (system/light/dark). null 이면 아직 정하지 않음 → 기기 설정
  @Column('varchar', { name: 'theme', length: 10, nullable: true })
  theme: string | null;

  // 데스크톱 알림 일시 중지
  @Column('boolean', { name: 'notificationsPaused', default: false })
  notificationsPaused: boolean;

  // 방해 금지 시간 (JSON: on, start 'HH:mm', end 'HH:mm', days 0~6(일~토), tz). 이 시간에는 알림을 보내지 않는다
  @Column('varchar', { name: 'dndSchedule', length: 200, nullable: true })
  dndSchedule: string | null;

  // 사람이 아닌 봇 계정 (예: 슐랙봇, 앱 봇). 로그인하지 않고 알림만 보낸다
  @Column('boolean', { name: 'bot', default: false })
  bot: boolean;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: '1234',
    description: '비밀번호',
  })
  @Column('varchar', { name: 'password', length: 100, select: false })
  password: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;

  @OneToMany(() => ChannelChats, (channelchats) => channelchats.User)
  ChannelChats: ChannelChats[];

  @OneToMany(() => ChannelMembers, (channelmembers) => channelmembers.User)
  ChannelMembers: ChannelMembers[];

  @OneToMany(() => DMs, (dms) => dms.Sender)
  DMs: DMs[];

  @OneToMany(() => DMs, (dms) => dms.Receiver)
  DMs2: DMs[];

  @OneToMany(() => Mentions, (mentions) => mentions.Sender)
  Mentions: Mentions[];

  @OneToMany(() => Mentions, (mentions) => mentions.Receiver)
  Mentions2: Mentions[];

  @OneToMany(
    () => WorkspaceMembers,
    (workspacemembers) => workspacemembers.User,
  )
  WorkspaceMembers: WorkspaceMembers[];

  @OneToMany(() => Workspaces, (workspaces) => workspaces.Owner)
  OwnedWorkspaces: Workspaces[];

  // 내가 속한 워크스페이스 목록 (LocalSerializer 에서 채워줌, DB 컬럼 아님)
  Workspaces?: Workspaces[];
}
