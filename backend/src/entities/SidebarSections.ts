import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SidebarSectionItems } from './SidebarSectionItems';

// 사이드바에 내가 직접 만든 섹션 (예: '프로젝트', '거래처'). 채널·DM 을 넣어 묶는다
@Index('sidebarsections_user', ['UserId', 'WorkspaceId'], {})
@Entity({ name: 'sidebarsections' })
export class SidebarSections {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'UserId' })
  UserId: number;

  @Column('int', { name: 'WorkspaceId' })
  WorkspaceId: number;

  @Column('varchar', { name: 'name', length: 40 })
  name: string;

  @Column('int', { name: 'position', default: 0 })
  position: number;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => SidebarSectionItems, (item) => item.Section)
  Items: SidebarSectionItems[];
}
