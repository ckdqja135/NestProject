import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Docs } from './Docs';

// 문서끼리의 링크 (FromId 문서 안에 ToId 문서로 가는 링크가 있다). 거꾸로 링크(백링크)를 보여 줄 때 쓴다
@Index('doclinks_to', ['ToId'])
@Entity({ name: 'doclinks' })
export class DocLinks {
  @PrimaryColumn('int', { name: 'FromId' })
  FromId: number;

  @PrimaryColumn('int', { name: 'ToId' })
  ToId: number;

  @ManyToOne(() => Docs, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'FromId', referencedColumnName: 'id' }])
  From: Docs;

  @ManyToOne(() => Docs, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'ToId', referencedColumnName: 'id' }])
  To: Docs;
}
