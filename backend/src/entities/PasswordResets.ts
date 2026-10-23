import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Users } from './Users';

// 비밀번호 재설정 링크. 링크의 토큰은 메일로만 보내고, 여기에는 해시만 둔다
@Entity({ name: 'passwordresets' })
export class PasswordResets {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'UserId' })
  UserId: number;

  @Index('passwordresets_token', { unique: true })
  @Column('char', { name: 'tokenHash', length: 64 })
  tokenHash: string;

  @Column('datetime', { name: 'expiresAt' })
  expiresAt: Date;

  @Column('datetime', { name: 'usedAt', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Users, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'UserId', referencedColumnName: 'id' }])
  User: Users;
}
