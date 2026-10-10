import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Channels } from './Channels';
import { Users } from './Users';
import { Workspaces } from './Workspaces';

// 예약 전송: 정한 시각(sendAt)에 서버가 대신 보낸다 (채널 또는 DM 중 하나)
@Index('sendAt', ['sendAt'], {})
@Entity({ name: 'scheduledmessages' })
export class ScheduledMessages {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'UserId' })
  UserId: number;

  @Column('int', { name: 'WorkspaceId' })
  WorkspaceId: number;

  @Column('int', { name: 'ChannelId', nullable: true })
  ChannelId: number | null;

  // DM 받는 사람
  @Column('int', { name: 'ReceiverId', nullable: true })
  ReceiverId: number | null;

  @Column('text', { name: 'content' })
  content: string;

  @Column('datetime', { name: 'sendAt' })
  sendAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Users, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'UserId', referencedColumnName: 'id' }])
  User: Users;

  @ManyToOne(() => Workspaces, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'WorkspaceId', referencedColumnName: 'id' }])
  Workspace: Workspaces;

  @ManyToOne(() => Channels, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'ChannelId', referencedColumnName: 'id' }])
  Channel: Channels | null;

  @ManyToOne(() => Users, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'ReceiverId', referencedColumnName: 'id' }])
  Receiver: Users | null;
}
