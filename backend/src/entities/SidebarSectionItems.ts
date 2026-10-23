import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SidebarSections } from './SidebarSections';

// 섹션에 넣은 채널·DM. 한 사람에게 같은 채널·DM 은 섹션 하나에만 들어간다
@Index(
  'sidebarsectionitems_target',
  ['UserId', 'WorkspaceId', 'kind', 'TargetId'],
  {
    unique: true,
  },
)
@Entity({ name: 'sidebarsectionitems' })
export class SidebarSectionItems {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'SectionId' })
  SectionId: number;

  @Column('int', { name: 'UserId' })
  UserId: number;

  @Column('int', { name: 'WorkspaceId' })
  WorkspaceId: number;

  // channel 이면 채널 id, dm 이면 상대 사용자 id
  @Column('varchar', { name: 'kind', length: 10 })
  kind: 'channel' | 'dm';

  @Column('int', { name: 'TargetId' })
  TargetId: number;

  @ManyToOne(() => SidebarSections, (section) => section.Items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'SectionId', referencedColumnName: 'id' }])
  Section: SidebarSections;
}
