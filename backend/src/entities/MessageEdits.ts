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

// 메시지 수정 내역: 수정할 때마다 바뀌기 전 내용을 남긴다 (채널 메시지 또는 DM 중 하나)
@Index('ChatId', ['ChatId'], {})
@Index('DMId', ['DMId'], {})
@Entity({ name: 'messageedits' })
export class MessageEdits {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'ChatId', nullable: true })
  ChatId: number | null;

  @Column('int', { name: 'DMId', nullable: true })
  DMId: number | null;

  // 수정되기 전 내용
  @Column('text', { name: 'content' })
  content: string;

  // 수정한 시각
  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => ChannelChats, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'ChatId', referencedColumnName: 'id' }])
  Chat: ChannelChats | null;

  @ManyToOne(() => DMs, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'DMId', referencedColumnName: 'id' }])
  DM: DMs | null;
}
