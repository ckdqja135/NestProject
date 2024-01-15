import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Channelchats } from './Channelchats';
import { ChannelMembers } from './Channelmembers';
import { Dms } from './Dms';
import { Mentions } from './Mentions';
import { WorkspaceMembers } from './Workspacemembers';
import { Workspaces } from './Workspaces';

@Index('email', ['email'], { unique: true })
@Entity('users', { schema: 'sleact' })
export class Users {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('varchar', { name: 'email', unique: true, length: 30 })
  email: string;

  @Column('varchar', { name: 'nickname', length: 30 })
  nickname: string;

  @Column('varchar', { name: 'password', length: 100, select: false })
  password: string;

  @Column('datetime', { name: 'createdAt' })
  createdAt: Date;

  @Column('datetime', { name: 'updatedAt' })
  updatedAt: Date;

  @Column('datetime', { name: 'deletedAt', nullable: true })
  deletedAt: Date | null;

  @OneToMany(() => Channelchats, (channelchats) => channelchats.user)
  channelchats: Channelchats[];

  @OneToMany(() => ChannelMembers, (channelmembers) => channelmembers.user)
  channelmembers: ChannelMembers[];

  @OneToMany(() => Dms, (dms) => dms.sender)
  dms: Dms[];

  @OneToMany(() => Dms, (dms) => dms.receiver)
  dms2: Dms[];

  @OneToMany(() => Mentions, (mentions) => mentions.sender)
  mentions: Mentions[];

  @OneToMany(() => Mentions, (mentions) => mentions.receiver)
  mentions2: Mentions[];

  @OneToMany(
    () => WorkspaceMembers,
    (workspacemembers) => workspacemembers.user,
  )
  workspacemembers: WorkspaceMembers[];

  @OneToMany(() => Workspaces, (workspaces) => workspaces.owner)
  workspaces: Workspaces[];
}
