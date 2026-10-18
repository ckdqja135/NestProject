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

// 나중에 보려고 저장한 메시지 (채널 메시지 또는 DM 중 하나)
@Index('user_chat', ['UserId', 'ChatId'], { unique: true })
@Index('user_dm', ['UserId', 'DMId'], { unique: true })
@Entity({ name: 'saveditems' })
export class SavedItems {
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

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Users, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'UserId', referencedColumnName: 'id' }])
  User: Users;

  @ManyToOne(() => Workspaces, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'WorkspaceId', referencedColumnName: 'id' }])
  Workspace: Workspaces;

  // 메시지가 삭제되면 저장한 항목도 함께 지워진다
  @ManyToOne(() => ChannelChats, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'ChatId', referencedColumnName: 'id' }])
  Chat: ChannelChats | null;

  @ManyToOne(() => DMs, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'DMId', referencedColumnName: 'id' }])
  DM: DMs | null;
}
