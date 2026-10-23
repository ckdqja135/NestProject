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
import { Channels } from './Channels';
import { Users } from './Users';
import { Workspaces } from './Workspaces';

export type SidebarPinKind = 'channel' | 'dm' | 'thread';

// 사이드바 맨 위에 고정한 대화 (채널, DM 상대, 스레드 중 하나). 사람마다 따로
@Index('sidebarpins_channel', ['UserId', 'ChannelId'], { unique: true })
@Index('sidebarpins_dm', ['UserId', 'WorkspaceId', 'PeerId'], { unique: true })
@Index('sidebarpins_thread', ['UserId', 'ChatId'], { unique: true })
@Entity({ name: 'sidebarpins' })
export class SidebarPins {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'UserId' })
  UserId: number;

  @Column('int', { name: 'WorkspaceId' })
  WorkspaceId: number;

  @Column('varchar', { name: 'kind', length: 10 })
  kind: SidebarPinKind;

  @Column('int', { name: 'ChannelId', nullable: true })
  ChannelId: number | null;

  @Column('int', { name: 'PeerId', nullable: true })
  PeerId: number | null;

  @Column('int', { name: 'ChatId', nullable: true })
  ChatId: number | null;

  // 작을수록 위
  @Column('int', { name: 'position', default: 0 })
  position: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Users, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'UserId', referencedColumnName: 'id' }])
  User: Users;

  @ManyToOne(() => Workspaces, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'WorkspaceId', referencedColumnName: 'id' }])
  Workspace: Workspaces;

  // 채널·상대·메시지가 지워지면 고정도 함께 지워진다
  @ManyToOne(() => Channels, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'ChannelId', referencedColumnName: 'id' }])
  Channel: Channels | null;

  @ManyToOne(() => Users, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'PeerId', referencedColumnName: 'id' }])
  Peer: Users | null;

  @ManyToOne(() => ChannelChats, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'ChatId', referencedColumnName: 'id' }])
  Chat: ChannelChats | null;
}
