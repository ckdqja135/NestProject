import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Approvals } from './Approvals';

// 결재 단계: 결재자 한 사람. 앞 사람이 승인해야 다음 사람 차례(pending)가 된다
@Index('approvalsteps_approver', ['ApproverId', 'status'], {})
@Entity({ name: 'approvalsteps' })
export class ApprovalSteps {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'ApprovalId' })
  ApprovalId: number;

  @Column('int', { name: 'position' })
  position: number;

  @Column('int', { name: 'ApproverId' })
  ApproverId: number;

  // waiting(앞 사람 기다림) pending(내 차례) approved rejected skipped(앞에서 반려·취소)
  @Column('varchar', { name: 'status', length: 10 })
  status: 'waiting' | 'pending' | 'approved' | 'rejected' | 'skipped';

  @Column('varchar', { name: 'comment', length: 500, nullable: true })
  comment: string | null;

  @Column('datetime', { name: 'decidedAt', nullable: true })
  decidedAt: Date | null;

  @ManyToOne(() => Approvals, (approval) => approval.Steps, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'ApprovalId', referencedColumnName: 'id' }])
  Approval: Approvals;
}
