import { Column, Entity } from 'typeorm';

// 어디까지 읽었는지 (기기 간 동기화). key: c:채널id, d:상대 사용자id, t:스레드 원본 메시지id
@Entity({ name: 'readmarkers' })
export class ReadMarkers {
  @Column('int', { primary: true, name: 'UserId' })
  UserId: number;

  @Column('int', { primary: true, name: 'WorkspaceId' })
  WorkspaceId: number;

  @Column('varchar', { primary: true, name: 'key', length: 40 })
  key: string;

  @Column('datetime', { name: 'lastReadAt', precision: 3 })
  lastReadAt: Date;
}
