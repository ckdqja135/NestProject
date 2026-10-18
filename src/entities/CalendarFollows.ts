import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Workspaces } from './Workspaces';
import { Users } from './Users';

// 동료 캘린더 구독: UserId 가 FollowingId 의 일정을 자기 캘린더에 겹쳐 본다
@Entity({ name: 'calendarfollows' })
export class CalendarFollows {
  @Column('int', { primary: true, name: 'WorkspaceId' })
  WorkspaceId: number;

  @Column('int', { primary: true, name: 'UserId' })
  UserId: number;

  @Column('int', { primary: true, name: 'FollowingId' })
  FollowingId: number;

  @ManyToOne(() => Workspaces, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'WorkspaceId', referencedColumnName: 'id' }])
  Workspace: Workspaces;

  @ManyToOne(() => Users, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'UserId', referencedColumnName: 'id' }])
  User: Users;

  @ManyToOne(() => Users, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'FollowingId', referencedColumnName: 'id' }])
  Following: Users;
}
