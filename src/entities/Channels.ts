import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Channelchats } from './Channelchats';
import { ChannelMembers } from './Channelmembers';
import { Workspaces } from './Workspaces';

@Index('WorkspaceId', ['workspaceId'], {})
@Entity('channels', { schema: 'sleact' })
export class Channels {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('varchar', { name: 'name', length: 30 })
  name: string;

  @Column('tinyint', {
    name: 'private',
    nullable: true,
    width: 1,
    default: () => "'0'",
  })
  private: boolean | null;

  @Column('datetime', { name: 'createdAt' })
  createdAt: Date;

  @Column('datetime', { name: 'updatedAt' })
  updatedAt: Date;

  @Column('int', { name: 'WorkspaceId', nullable: true })
  workspaceId: number | null;

  @OneToMany(() => Channelchats, (channelchats) => channelchats.channel)
  channelchats: Channelchats[];

  @OneToMany(() => ChannelMembers, (channelmembers) => channelmembers.channel)
  channelmembers: ChannelMembers[];

  @ManyToOne(() => Workspaces, (workspaces) => workspaces.channels, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'workspaceId', referencedColumnName: 'id' }])
  workspace: Workspaces;
}
