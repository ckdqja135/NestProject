import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { UserGroups } from './UserGroups';
import { Users } from './Users';

@Index('UserId', ['UserId'], {})
@Entity({ name: 'usergroupmembers' })
export class UserGroupMembers {
  @Column('int', { primary: true, name: 'GroupId' })
  GroupId: number;

  @Column('int', { primary: true, name: 'UserId' })
  UserId: number;

  @ManyToOne(() => UserGroups, (group) => group.Members, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'GroupId', referencedColumnName: 'id' }])
  Group: UserGroups;

  @ManyToOne(() => Users, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'UserId', referencedColumnName: 'id' }])
  User: Users;
}
