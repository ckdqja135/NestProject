import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Channels } from './Channels';
import { Docs } from './Docs';

// 채널 탭: 채널 위에 문서·데이터베이스·디자인을 고정해 둔다.
// access 가 view·edit 이면 그 채널 멤버 모두가 이 문서를 보고(·고치고) 채널을 나가면 권한도 빠진다
@Index('channeltabs_channel_doc', ['ChannelId', 'DocId'], { unique: true })
@Index('channeltabs_doc', ['DocId'], {})
@Entity({ name: 'channeltabs' })
export class ChannelTabs {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'ChannelId' })
  ChannelId: number;

  @Column('int', { name: 'DocId' })
  DocId: number;

  // none(문서 권한 그대로) view(채널 멤버 보기) edit(채널 멤버 편집)
  @Column('varchar', { name: 'access', length: 10, default: 'none' })
  access: 'none' | 'view' | 'edit';

  // 이 문서의 댓글·수정·항목 변경을 채널에 알릴지
  @Column('boolean', { name: 'notify', default: false })
  notify: boolean;

  @Column('int', { name: 'position', default: 0 })
  position: number;

  @Column('int', { name: 'CreatorId', nullable: true })
  CreatorId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Channels, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'ChannelId', referencedColumnName: 'id' }])
  Channel: Channels;

  @ManyToOne(() => Docs, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'DocId', referencedColumnName: 'id' }])
  Doc: Docs;
}
