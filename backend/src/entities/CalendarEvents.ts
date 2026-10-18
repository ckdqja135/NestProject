import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Workspaces } from './Workspaces';
import { Users } from './Users';
import { CalendarAttendees } from './CalendarAttendees';

// 캘린더 일정. 종일 일정은 startAt 이 그날 0시, endAt 이 다음 날 0시 (끝은 포함하지 않는다)
@Index('calendarevents_range', ['WorkspaceId', 'startAt'])
@Entity({ name: 'calendarevents' })
export class CalendarEvents {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'WorkspaceId' })
  WorkspaceId: number;

  @Column('varchar', { name: 'title', length: 120 })
  title: string;

  @Column('text', { name: 'description', nullable: true })
  description: string | null;

  @Column('varchar', { name: 'location', length: 120, nullable: true })
  location: string | null;

  @Column('datetime', { name: 'startAt' })
  startAt: Date;

  @Column('datetime', { name: 'endAt' })
  endAt: Date;

  @Column('boolean', { name: 'allDay', default: false })
  allDay: boolean;

  @Column('varchar', { name: 'color', length: 20, nullable: true })
  color: string | null;

  // public: 워크스페이스 멤버가 제목을 볼 수 있음, private: 참석자 외에는 '바쁨' 으로만 보임
  @Column('varchar', { name: 'visibility', length: 10, default: 'public' })
  visibility: 'public' | 'private';

  // 시작 몇 분 전에 알릴지 (null 이면 알리지 않음)
  @Column('int', { name: 'reminderMinutes', nullable: true })
  reminderMinutes: number | null;

  @Column('datetime', { name: 'remindedAt', nullable: true })
  remindedAt: Date | null;

  @Column('int', { name: 'OwnerId', nullable: true })
  OwnerId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Workspaces, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'WorkspaceId', referencedColumnName: 'id' }])
  Workspace: Workspaces;

  @ManyToOne(() => Users, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'OwnerId', referencedColumnName: 'id' }])
  Owner: Users | null;

  @OneToMany(() => CalendarAttendees, (attendee) => attendee.Event)
  Attendees: CalendarAttendees[];
}
