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
import { Workspaces } from './Workspaces';

// 내 문서 라이브러리의 폴더 (폴더 안에 폴더를 둘 수 있다)
@Index('workspace_owner', ['WorkspaceId', 'OwnerId'], {})
@Entity({ name: 'docfolders' })
export class DocFolders {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'WorkspaceId' })
  WorkspaceId: number;

  @Column('varchar', { name: 'name', length: 60 })
  name: string;

  @Column('int', { name: 'ParentId', nullable: true })
  ParentId: number | null;

  @Column('int', { name: 'OwnerId' })
  OwnerId: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Workspaces, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'WorkspaceId', referencedColumnName: 'id' }])
  Workspace: Workspaces;

  // 상위 폴더를 지우면 하위 폴더도 지워진다 (안의 문서는 폴더 밖으로 나온다)
  @ManyToOne(() => DocFolders, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'ParentId', referencedColumnName: 'id' }])
  Parent: DocFolders | null;

  @ManyToOne(() => Users, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'OwnerId', referencedColumnName: 'id' }])
  Owner: Users;
}
