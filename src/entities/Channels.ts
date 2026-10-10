import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ChannelChats } from './ChannelChats';
import { ChannelMembers } from './ChannelMembers';
import { Workspaces } from './Workspaces';
import { Users } from './Users';

@Index('WorkspaceId', ['WorkspaceId'], {})
@Entity('channels')
export class Channels {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('varchar', { name: 'name', length: 30 })
  name: string;

  // 비공개 채널 여부 (초대받은 사람만 참여). boolean 타입이어야 0/1 이 아닌 true/false 로 변환된다.
  @Column('boolean', { name: 'private', nullable: true, default: false })
  private: boolean | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column('int', { name: 'WorkspaceId', nullable: true })
  WorkspaceId: number | null;

  // 채널 주제 (채널 이름 아래에 보인다)
  @Column('varchar', { name: 'topic', length: 250, nullable: true })
  topic: string | null;

  // 보관된 채널: 읽기만 가능
  @Column('boolean', { name: 'archived', default: false })
  archived: boolean;

  // 채널을 만든 사람 (워크스페이스 소유자와 함께 채널을 관리할 수 있다)
  @Column('int', { name: 'OwnerId', nullable: true })
  OwnerId: number | null;

  @ManyToOne(() => Users, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'OwnerId', referencedColumnName: 'id' }])
  Owner: Users;

  @OneToMany(() => ChannelChats, (channelchats) => channelchats.Channel)
  ChannelChats: ChannelChats[];

  @OneToMany(() => ChannelMembers, (channelMembers) => channelMembers.Channel, {
    cascade: ['insert'],
  })
  ChannelMembers: ChannelMembers[];

  @ManyToOne(() => Workspaces, (workspaces) => workspaces.Channels, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'WorkspaceId', referencedColumnName: 'id' }])
  Workspace: Workspaces;
}
