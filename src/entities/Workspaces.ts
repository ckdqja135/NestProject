import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Channels } from './Channels';
import { Dms } from './Dms';
import { Mentions } from './Mentions';
import { Workspacemembers } from './Workspacemembers';
import { Users } from './Users';

@Index('name', ['name'], { unique: true })
@Index('OwnerId', ['ownerId'], {})
@Index('url', ['url'], { unique: true })
@Entity('workspaces', { schema: 'sleact' })
export class Workspaces {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('varchar', { name: 'name', unique: true, length: 30 })
  name: string;

  @Column('varchar', { name: 'url', unique: true, length: 30 })
  url: string;

  @CreateDateColumn({ default: () => 'CURRENT_TIMESTAMP' })
  @Column('datetime', { name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ default: () => 'CURRENT_TIMESTAMP' })
  @Column('datetime', { name: 'updatedAt' })
  updatedAt: Date;

  @Column('datetime', { name: 'deletedAt', nullable: true })
  deletedAt: Date | null;

  @Column('int', { name: 'OwnerId', nullable: true })
  ownerId: number | null;

  @OneToMany(() => Channels, (channels) => channels.workspace)
  channels: Channels[];

  @OneToMany(() => Dms, (dms) => dms.workspace)
  dms: Dms[];

  @OneToMany(() => Mentions, (mentions) => mentions.workspace)
  mentions: Mentions[];

  @OneToMany(
    () => Workspacemembers,
    (workspacemembers) => workspacemembers.workspace,
  )
  workspacemembers: Workspacemembers[];

  @ManyToOne(() => Users, (users) => users.workspaces, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'OwnerId', referencedColumnName: 'id' }])
  owner: Users;
}
