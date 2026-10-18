import { Column, Entity, UpdateDateColumn } from 'typeorm';

// DM 읽음 표시: 대화마다 내가(UserId) 상대(PartnerId)의 메시지를 어디까지 읽었는지
@Entity({ name: 'dmreads' })
export class DMReads {
  @Column('int', { primary: true, name: 'WorkspaceId' })
  WorkspaceId: number;

  @Column('int', { primary: true, name: 'UserId' })
  UserId: number;

  @Column('int', { primary: true, name: 'PartnerId' })
  PartnerId: number;

  @Column('int', { name: 'lastReadId', default: 0 })
  lastReadId: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
