import { Column, Entity } from 'typeorm';

// 쓰다 만 메시지 (기기 간 동기화). key: channel:채널이름, dm:상대 사용자id
@Entity({ name: 'drafts' })
export class Drafts {
  @Column('int', { primary: true, name: 'UserId' })
  UserId: number;

  @Column('int', { primary: true, name: 'WorkspaceId' })
  WorkspaceId: number;

  @Column('varchar', { primary: true, name: 'key', length: 60 })
  key: string;

  @Column('text', { name: 'content' })
  content: string;

  @Column('datetime', { name: 'updatedAt', precision: 3 })
  updatedAt: Date;
}
