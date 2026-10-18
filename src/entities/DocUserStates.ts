import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Docs } from './Docs';
import { Users } from './Users';

// 사람마다의 문서 상태: 즐겨찾기(고정), 마지막으로 연 시각(최근 목록)
@Entity({ name: 'docuserstates' })
export class DocUserStates {
  @Column('int', { primary: true, name: 'UserId' })
  UserId: number;

  @Column('int', { primary: true, name: 'DocId' })
  DocId: number;

  @Column('boolean', { name: 'favorite', default: false })
  favorite: boolean;

  @Column('datetime', { name: 'viewedAt', nullable: true })
  viewedAt: Date | null;

  @ManyToOne(() => Docs, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'DocId', referencedColumnName: 'id' }])
  Doc: Docs;

  @ManyToOne(() => Users, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'UserId', referencedColumnName: 'id' }])
  User: Users;
}
