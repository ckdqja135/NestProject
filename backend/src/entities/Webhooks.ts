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

// 수신 웹훅: 외부 서비스가 POST /api/hooks/:token 으로 채널에 메시지를 보낸다
@Index('token', ['token'], { unique: true })
@Entity({ name: 'webhooks' })
export class Webhooks {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'ChannelId' })
  ChannelId: number;

  // 메시지에 보낸 사람으로 보이는 이름 (예: GitHub)
  @Column('varchar', { name: 'name', length: 40 })
  name: string;

  @Column('varchar', { name: 'token', length: 64 })
  token: string;

  @Column('int', { name: 'CreatorId', nullable: true })
  CreatorId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Channels, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'ChannelId', referencedColumnName: 'id' }])
  Channel: Channels;

  @ManyToOne(() => Users, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'CreatorId', referencedColumnName: 'id' }])
  Creator: Users | null;
}
