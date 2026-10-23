import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Users } from './Users';
import { Workspaces } from './Workspaces';

// 별표한 워크스페이스 동료 (사람마다 따로)
@Entity({ name: 'contactstars' })
export class ContactStars {
  @PrimaryColumn('int', { name: 'UserId' })
  UserId: number;

  @PrimaryColumn('int', { name: 'WorkspaceId' })
  WorkspaceId: number;

  @PrimaryColumn('int', { name: 'MemberId' })
  MemberId: number;

  @ManyToOne(() => Users, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'UserId', referencedColumnName: 'id' }])
  User: Users;

  @ManyToOne(() => Workspaces, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'WorkspaceId', referencedColumnName: 'id' }])
  Workspace: Workspaces;

  @ManyToOne(() => Users, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'MemberId', referencedColumnName: 'id' }])
  Member: Users;
}
