import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Docs } from './Docs';
import { Users } from './Users';

// 문서 접근 요청: 권한이 없는 사람이 링크로 열었을 때 문서 주인에게 보기·편집 권한을 요청한다.
// 허락하거나 거절하면 지운다 (기다리는 요청만 남는다)
@Index('docaccessrequests_doc_user', ['DocId', 'UserId'], { unique: true })
@Entity({ name: 'docaccessrequests' })
export class DocAccessRequests {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'DocId' })
  DocId: number;

  @Column('int', { name: 'UserId' })
  UserId: number;

  @Column('varchar', { name: 'role', length: 10, default: 'view' })
  role: 'view' | 'edit';

  @Column('varchar', { name: 'message', length: 300, nullable: true })
  message: string | null;

  // 마지막으로 요청한 때 (같은 요청을 짧은 사이에 여러 번 알리지 않으려고)
  @Column('datetime', { name: 'requestedAt' })
  requestedAt: Date;

  @ManyToOne(() => Docs, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'DocId', referencedColumnName: 'id' }])
  Doc: Docs;

  @ManyToOne(() => Users, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'UserId', referencedColumnName: 'id' }])
  User: Users;
}
