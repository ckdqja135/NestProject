import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserGroupMembers } from './UserGroupMembers';
import { Users } from './Users';
import { Workspaces } from './Workspaces';

// 사용자 그룹 (예: @디자인팀). 멘션하면 그룹 멤버에게 알린다.
@Index('workspace_name', ['WorkspaceId', 'name'], { unique: true })
@Entity({ name: 'usergroups' })
export class UserGroups {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'WorkspaceId' })
  WorkspaceId: number;

  @Column('varchar', { name: 'name', length: 30 })
  name: string;

  @Column('varchar', { name: 'description', length: 100, nullable: true })
  description: string | null;

  // 만든 사람 (워크스페이스 소유자와 함께 이름 변경·삭제를 할 수 있다)
  @Column('int', { name: 'CreatorId', nullable: true })
  CreatorId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Workspaces, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'WorkspaceId', referencedColumnName: 'id' }])
  Workspace: Workspaces;

  @ManyToOne(() => Users, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'CreatorId', referencedColumnName: 'id' }])
  Creator: Users | null;

  @OneToMany(() => UserGroupMembers, (member) => member.Group)
  Members: UserGroupMembers[];
}
