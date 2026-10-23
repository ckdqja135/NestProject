import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// 브라우저 푸시 알림 구독 (기기·브라우저마다 하나). 탭을 모두 닫아도 멘션·DM 알림을 보낸다
@Index('pushsubscriptions_user', ['UserId'], {})
@Entity({ name: 'pushsubscriptions' })
export class PushSubscriptions {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'UserId' })
  UserId: number;

  // 브라우저 회사의 푸시 서버 주소 (구독마다 다름)
  @Index('pushsubscriptions_endpoint', { unique: true })
  @Column('varchar', { name: 'endpoint', length: 500 })
  endpoint: string;

  @Column('varchar', { name: 'p256dh', length: 200 })
  p256dh: string;

  @Column('varchar', { name: 'auth', length: 100 })
  auth: string;

  @CreateDateColumn()
  createdAt: Date;
}
