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
import { Users } from './Users';
import { Channels } from './Channels';
import { Reactions } from './Reactions';

@Index('UserId', ['UserId'], {})
@Index('ChannelId', ['ChannelId'], {})
@Index('ParentId', ['ParentId'], {})
@Entity({ name: 'channelchats' })
export class ChannelChats {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('text', { name: 'content' })
  content: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // 내용을 수정한 시각 (고정 등 다른 변경과 구분하기 위해 updatedAt 과 별도로 관리)
  @Column('datetime', { name: 'editedAt', nullable: true })
  editedAt: Date | null;

  @Column('int', { name: 'UserId', nullable: true })
  UserId: number | null;

  @Column('int', { name: 'ChannelId', nullable: true })
  ChannelId: number | null;

  // 스레드 답글이면 원본 메시지 id, 일반 메시지면 null
  @Column('int', { name: 'ParentId', nullable: true })
  ParentId: number | null;

  @Column('boolean', { name: 'pinned', default: false })
  pinned: boolean;

  @ManyToOne(() => Users, (users) => users.ChannelChats, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'UserId', referencedColumnName: 'id' }])
  User: Users;

  @ManyToOne(() => Channels, (channels) => channels.ChannelChats, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'ChannelId', referencedColumnName: 'id' }])
  Channel: Channels;

  @ManyToOne(() => ChannelChats, (chat) => chat.Replies, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'ParentId', referencedColumnName: 'id' }])
  Parent: ChannelChats;

  @OneToMany(() => ChannelChats, (chat) => chat.Parent)
  Replies: ChannelChats[];

  @OneToMany(() => Reactions, (reactions) => reactions.Chat)
  Reactions: Reactions[];

  // 답글 수 (조회 시 계산, DB 컬럼 아님)
  replyCount?: number;
}
