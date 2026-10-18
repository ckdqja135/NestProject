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

// 워크스페이스 전용 이모지 (:이름: 으로 쓴다). 그림은 작은 data URL 로 DB 에 둔다 (서버에 파일을 두지 않음)
@Index('workspace_name', ['WorkspaceId', 'name'], { unique: true })
@Entity({ name: 'customemojis' })
export class CustomEmojis {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'WorkspaceId' })
  WorkspaceId: number;

  @Column('varchar', { name: 'name', length: 14 })
  name: string;

  @Column('mediumtext', { name: 'image' })
  image: string;

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
}
