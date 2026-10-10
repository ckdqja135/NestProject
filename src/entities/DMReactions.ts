import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DMs } from './DMs';
import { Users } from './Users';

// DM 에 단 이모지 리액션. 같은 사람이 같은 메시지에 같은 이모지는 한 번만.
@Index('dm_user_emoji', ['DMId', 'UserId', 'emoji'], { unique: true })
@Index('UserId', ['UserId'], {})
@Entity({ name: 'dmreactions' })
export class DMReactions {
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

  @Column('int', { name: 'DMId' })
  DMId: number;

  @Column('int', { name: 'UserId' })
  UserId: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => DMs, (dm) => dm.Reactions, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'DMId', referencedColumnName: 'id' }])
  DM: DMs;

  @ManyToOne(() => Users, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'UserId', referencedColumnName: 'id' }])
  User: Users;
}
