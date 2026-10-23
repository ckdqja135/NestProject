import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// 데이터베이스 항목 중 담당자가 있는 것 ("내 할 일" 모아 보기·맡김 알림용).
// 원본은 데이터베이스의 실시간 편집 상태이고, 저장할 때마다 여기에 다시 적는다
@Index('doctasks_row', ['DocId', 'RowId'], { unique: true })
@Index('doctasks_workspace', ['WorkspaceId'], {})
@Entity({ name: 'doctasks' })
export class DocTasks {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'DocId' })
  DocId: number;

  @Column('varchar', { name: 'RowId', length: 40 })
  RowId: string;

  @Column('int', { name: 'WorkspaceId' })
  WorkspaceId: number;

  @Column('varchar', { name: 'title', length: 300 })
  title: string;

  // 'YYYY-MM-DD'
  @Column('varchar', { name: 'due', length: 10, nullable: true })
  due: string | null;

  @Column('varchar', { name: 'statusName', length: 60, nullable: true })
  statusName: string | null;

  @Column('boolean', { name: 'done', default: false })
  done: boolean;

  // 담당자 id 목록 (쉼표로 구분, 앞뒤에도 쉼표: ',3,7,')
  @Column('varchar', { name: 'assignees', length: 500 })
  assignees: string;

  @Column('datetime', { name: 'updatedAt' })
  updatedAt: Date;
}
