import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApprovalSteps } from './ApprovalSteps';

// 결재(승인 요청): 채팅에 카드로 올리고, 결재자가 순서대로 승인·반려한다
@Index('approvals_workspace', ['WorkspaceId'], {})
@Entity({ name: 'approvals' })
export class Approvals {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'WorkspaceId' })
  WorkspaceId: number;

  @Column('int', { name: 'RequesterId' })
  RequesterId: number;

  // general(일반) leave(휴가) expense(지출) purchase(구매)
  @Column('varchar', { name: 'kind', length: 20, default: 'general' })
  kind: string;

  @Column('varchar', { name: 'title', length: 200 })
  title: string;

  @Column('text', { name: 'body', nullable: true })
  body: string | null;

  // 종류별 칸 (JSON: 기간·금액 등)
  @Column('varchar', { name: 'fields', length: 1000, nullable: true })
  fields: string | null;

  // pending(진행 중) approved(승인) rejected(반려) canceled(취소)
  @Column('varchar', { name: 'status', length: 10, default: 'pending' })
  status: 'pending' | 'approved' | 'rejected' | 'canceled';

  // 카드를 올린 곳: 채널이면 ChannelId, DM 이면 상대 PeerId
  @Column('int', { name: 'ChannelId', nullable: true })
  ChannelId: number | null;

  @Column('int', { name: 'PeerId', nullable: true })
  PeerId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column('datetime', { name: 'decidedAt', nullable: true })
  decidedAt: Date | null;

  @OneToMany(() => ApprovalSteps, (step) => step.Approval)
  Steps: ApprovalSteps[];
}
