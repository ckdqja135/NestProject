import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AppCommands } from './AppCommands';
import { Users } from './Users';
import { Workspaces } from './Workspaces';

// 외부 앱 연동: 앱마다 봇 계정 하나와 봇 토큰(앱 API), 서명 비밀값(이벤트·명령 요청 서명)을 둔다
@Index('apps_token', ['tokenHash'], { unique: true })
@Index('apps_workspace', ['WorkspaceId'], {})
@Entity({ name: 'apps' })
export class Apps {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'WorkspaceId' })
  WorkspaceId: number;

  // 봇 계정 이름과 같다
  @Column('varchar', { name: 'name', length: 30 })
  name: string;

  @Column('varchar', { name: 'description', length: 200, nullable: true })
  description: string | null;

  @Column('int', { name: 'BotUserId' })
  BotUserId: number;

  // 봇 토큰은 만들 때 한 번만 보여 주고 해시만 둔다
  @Column('char', { name: 'tokenHash', length: 64 })
  tokenHash: string;

  // 어떤 토큰인지 알아보게 끝 네 글자
  @Column('varchar', { name: 'tokenHint', length: 8 })
  tokenHint: string;

  // 우리가 앱에 보내는 요청에 서명하는 비밀값 (앱이 우리 요청인지 확인한다)
  @Column('varchar', { name: 'signingSecret', length: 64, select: false })
  signingSecret: string;

  // 이벤트를 받을 주소와 받을 이벤트 (쉼표로 구분)
  @Column('varchar', { name: 'eventUrl', length: 500, nullable: true })
  eventUrl: string | null;

  @Column('varchar', { name: 'events', length: 100, default: '' })
  events: string;

  // 메시지 버튼을 누르면 보낼 주소 (없으면 이벤트 주소로)
  @Column('varchar', { name: 'interactionUrl', length: 500, nullable: true })
  interactionUrl: string | null;

  // 마지막 이벤트 전달 결과 (관리 화면에서 확인)
  @Column('datetime', { name: 'lastEventAt', nullable: true })
  lastEventAt: Date | null;

  @Column('varchar', { name: 'lastEventError', length: 200, nullable: true })
  lastEventError: string | null;

  @Column('int', { name: 'CreatorId', nullable: true })
  CreatorId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Workspaces, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'WorkspaceId', referencedColumnName: 'id' }])
  Workspace: Workspaces;

  @ManyToOne(() => Users, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'BotUserId', referencedColumnName: 'id' }])
  BotUser: Users;

  @OneToMany(() => AppCommands, (command) => command.App)
  Commands: AppCommands[];
}
