import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { CalendarEvents } from './CalendarEvents';
import { Users } from './Users';

// 일정 참석자와 참석 여부. 주최자도 참석자로 들어간다 (accepted)
@Entity({ name: 'calendarattendees' })
export class CalendarAttendees {
  @Column('int', { primary: true, name: 'EventId' })
  EventId: number;

  @Column('int', { primary: true, name: 'UserId' })
  UserId: number;

  @Column('varchar', { name: 'status', length: 10, default: 'pending' })
  status: 'pending' | 'accepted' | 'declined';

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => CalendarEvents, (event) => event.Attendees, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'EventId', referencedColumnName: 'id' }])
  Event: CalendarEvents;

  @ManyToOne(() => Users, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'UserId', referencedColumnName: 'id' }])
  User: Users;
}
