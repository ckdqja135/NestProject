import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Docs } from './Docs';
import { Users } from './Users';

// 특정 사람과 문서 공유 (보기 또는 편집)
@Entity({ name: 'docshares' })
export class DocShares {
  @Column('int', { primary: true, name: 'DocId' })
  DocId: number;

  @Column('int', { primary: true, name: 'UserId' })
  UserId: number;

  @Column('varchar', { name: 'role', length: 10, default: 'view' })
  role: 'view' | 'edit';

  @ManyToOne(() => Docs, (doc) => doc.Shares, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'DocId', referencedColumnName: 'id' }])
  Doc: Docs;

  @ManyToOne(() => Users, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'UserId', referencedColumnName: 'id' }])
  User: Users;
}
