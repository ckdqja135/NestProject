import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Channelchats } from './Channelchats';
import { Channelmembers } from './Channelmembers';
import { Dms } from './Dms';
import { Mentions } from './Mentions';
import { Workspacemembers } from './Workspacemembers';
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

  @OneToMany(() => Channelmembers, (channelmembers) => channelmembers.user)
  channelmembers: Channelmembers[];

  @OneToMany(() => Dms, (dms) => dms.sender)
  dms: Dms[];

  @OneToMany(() => Dms, (dms) => dms.receiver)
  dms2: Dms[];

  @OneToMany(() => Mentions, (mentions) => mentions.sender)
  mentions: Mentions[];

  @OneToMany(() => Mentions, (mentions) => mentions.receiver)
  mentions2: Mentions[];

  @OneToMany(
    () => Workspacemembers,
    (workspacemembers) => workspacemembers.user,
  )
  workspacemembers: Workspacemembers[];

  @OneToMany(() => Workspaces, (workspaces) => workspaces.owner)
  workspaces: Workspaces[];
}