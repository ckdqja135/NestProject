import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DocFolders } from './DocFolders';
import { DocShares } from './DocShares';
import { Users } from './Users';
import { Workspaces } from './Workspaces';

// 문서. 내용은 마크다운 글로만 저장한다 (파일을 서버에 두지 않음)
// type: doc(마크다운 문서) wiki(위키 페이지, 워크스페이스 전체 공개, 페이지 트리)
//       slides(슬라이드, 내용은 쪽·글상자·도형 JSON) sheet(스프레드시트, 내용은 셀 JSON)
@Index('WorkspaceId', ['WorkspaceId'], {})
@Entity({ name: 'docs' })
export class Docs {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'WorkspaceId' })
  WorkspaceId: number;

  @Column('varchar', { name: 'type', length: 10, default: 'doc' })
  type: 'doc' | 'wiki' | 'slides' | 'sheet';

  @Column('varchar', { name: 'title', length: 200 })
  title: string;

  @Column('mediumtext', { name: 'content' })
  content: string;

  // 공개 범위: private(나와 공유한 사람만) workspace(워크스페이스 누구나 보기·편집)
  @Column('varchar', { name: 'visibility', length: 10, default: 'private' })
  visibility: 'private' | 'workspace';

  @Column('int', { name: 'FolderId', nullable: true })
  FolderId: number | null;

  // 위키 페이지의 상위 페이지
  @Column('int', { name: 'ParentId', nullable: true })
  ParentId: number | null;

  @Column('int', { name: 'OwnerId', nullable: true })
  OwnerId: number | null;

  @Column('int', { name: 'LastEditorId', nullable: true })
  LastEditorId: number | null;

  // 동시에 고칠 때 덮어쓰지 않도록 저장할 때마다 1씩 올린다
  @Column('int', { name: 'version', default: 1 })
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // 휴지통
  @DeleteDateColumn()
  deletedAt: Date | null;

  @ManyToOne(() => Workspaces, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'WorkspaceId', referencedColumnName: 'id' }])
  Workspace: Workspaces;

  @ManyToOne(() => DocFolders, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'FolderId', referencedColumnName: 'id' }])
  Folder: DocFolders | null;

  @ManyToOne(() => Docs, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'ParentId', referencedColumnName: 'id' }])
  Parent: Docs | null;

  @ManyToOne(() => Users, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'OwnerId', referencedColumnName: 'id' }])
  Owner: Users | null;

  @ManyToOne(() => Users, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'LastEditorId', referencedColumnName: 'id' }])
  LastEditor: Users | null;

  @OneToMany(() => DocShares, (share) => share.Doc)
  Shares: DocShares[];
}
