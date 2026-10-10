import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ChannelChats } from './ChannelChats';
import { DMs } from './DMs';
import { Users } from './Users';
import { Workspaces } from './Workspaces';

// 리마인더: 정한 시각(remindAt)에 이 메시지를 다시 알려준다 (채널 메시지 또는 DM 중 하나)
@Index('remindAt', ['remindAt'], {})
@Entity({ name: 'reminders' })
export class Reminders {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'UserId' })
  UserId: number;

  @Column('int', { name: 'WorkspaceId' })
  WorkspaceId: number;

  @Column('int', { name: 'ChatId', nullable: true })
  ChatId: number | null;

  @Column('int', { name: 'DMId', nullable: true })
  DMId: number | null;

  @Column('datetime', { name: 'remindAt' })
  remindAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Users, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'UserId', referencedColumnName: 'id' }])
  User: Users;

  @ManyToOne(() => Workspaces, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'WorkspaceId', referencedColumnName: 'id' }])
  Workspace: Workspaces;

  // 메시지가 지워지면 리마인더도 함께 지워진다
  @ManyToOne(() => ChannelChats, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'ChatId', referencedColumnName: 'id' }])
  Chat: ChannelChats | null;

  @ManyToOne(() => DMs, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'DMId', referencedColumnName: 'id' }])
  DM: DMs | null;
}
