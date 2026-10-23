import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Docs } from './Docs';
import { Users } from './Users';

// 문서 댓글. 같은 threadId 끼리 한 대화(스레드)이고, 첫 댓글에 해결 여부를 둔다.
// 글에 붙인 댓글은 문서 안 글자에 threadId 표시가 있고, quote 는 그때 고른 글이다
@Index('doccomments_doc', ['DocId', 'threadId'])
@Entity({ name: 'doccomments' })
export class DocComments {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'DocId' })
  DocId: number;

  @Column('int', { name: 'UserId', nullable: true })
  UserId: number | null;

  @Column('varchar', { name: 'threadId', length: 40 })
  threadId: string;

  @Column('text', { name: 'content' })
  content: string;

  @Column('varchar', { name: 'quote', length: 300, nullable: true })
  quote: string | null;

  @Column('boolean', { name: 'resolved', default: false })
  resolved: boolean;

  @Column('datetime', { name: 'editedAt', nullable: true })
  editedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Docs, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'DocId', referencedColumnName: 'id' }])
  Doc: Docs;

  @ManyToOne(() => Users, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'UserId', referencedColumnName: 'id' }])
  User: Users | null;
}
