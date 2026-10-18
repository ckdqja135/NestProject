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
import { Users } from './Users';

// 채널 메시지에 단 이모지 리액션. 같은 사람이 같은 메시지에 같은 이모지는 한 번만.
@Index('chat_user_emoji', ['ChatId', 'UserId', 'emoji'], { unique: true })
@Index('UserId', ['UserId'], {})
@Entity({ name: 'reactions' })
export class Reactions {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  // 기본 콜레이션(utf8mb4_general_ci)은 모든 이모지를 같은 문자로 비교하므로 바이너리 비교 사용
  @Column({
    type: 'varchar',
    name: 'emoji',
    length: 16,
    charset: 'utf8mb4',
    collation: 'utf8mb4_bin',
  })
  emoji: string;

  @Column('int', { name: 'ChatId' })
  ChatId: number;

  @Column('int', { name: 'UserId' })
  UserId: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => ChannelChats, (chat) => chat.Reactions, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'ChatId', referencedColumnName: 'id' }])
  Chat: ChannelChats;

  @ManyToOne(() => Users, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'UserId', referencedColumnName: 'id' }])
  User: Users;
}
