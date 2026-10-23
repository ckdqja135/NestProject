import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Users } from './Users';
import { Workspaces } from './Workspaces';

// 외부 연락처: 워크스페이스 밖 사람 (거래처, 고객 등). 만든 사람만 본다
@Index('contacts_owner', ['OwnerId', 'WorkspaceId'])
@Entity({ name: 'contacts' })
export class Contacts {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'OwnerId' })
  OwnerId: number;

  @Column('int', { name: 'WorkspaceId' })
  WorkspaceId: number;

  @Column('varchar', { name: 'name', length: 40 })
  name: string;

  @Column('varchar', { name: 'company', length: 60, nullable: true })
  company: string | null;

  @Column('varchar', { name: 'department', length: 40, nullable: true })
  department: string | null;

  @Column('varchar', { name: 'jobTitle', length: 40, nullable: true })
  jobTitle: string | null;

  @Column('varchar', { name: 'email', length: 100, nullable: true })
  email: string | null;

  @Column('varchar', { name: 'phone', length: 30, nullable: true })
  phone: string | null;

  @Column('varchar', { name: 'memo', length: 500, nullable: true })
  memo: string | null;

  @Column('boolean', { name: 'starred', default: false })
  starred: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Users, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'OwnerId', referencedColumnName: 'id' }])
  Owner: Users;

  @ManyToOne(() => Workspaces, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'WorkspaceId', referencedColumnName: 'id' }])
  Workspace: Workspaces;
}
