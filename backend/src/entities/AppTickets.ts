import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Apps } from './Apps';

// 앱의 늦은 답 주소(response_url): 슬래시 명령·버튼을 쓴 사람과 대화를 기억한다.
// 주소에 든 토큰은 해시로만 둔다. 30분 동안 5번까지 쓸 수 있다
@Index('apptickets_token', ['tokenHash'], { unique: true })
@Entity({ name: 'apptickets' })
export class AppTickets {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('char', { name: 'tokenHash', length: 64 })
  tokenHash: string;

  @Column('int', { name: 'AppId' })
  AppId: number;

  // 워크스페이스 주소
  @Column('varchar', { name: 'url', length: 30 })
  url: string;

  // 명령을 쓰거나 버튼을 누른 사람
  @Column('int', { name: 'UserId' })
  UserId: number;

  @Column('varchar', { name: 'channel', length: 80, nullable: true })
  channel: string | null;

  @Column('int', { name: 'dmUserId', nullable: true })
  dmUserId: number | null;

  @Column('datetime', { name: 'expiresAt' })
  expiresAt: Date;

  @Column('int', { name: 'uses', default: 0 })
  uses: number;

  @ManyToOne(() => Apps, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'AppId', referencedColumnName: 'id' }])
  App: Apps;
}
