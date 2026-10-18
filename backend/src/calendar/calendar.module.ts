import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DmsModule } from '../dms/dms.module';
import { CalendarAttendees } from '../entities/CalendarAttendees';
import { CalendarEvents } from '../entities/CalendarEvents';
import { CalendarFollows } from '../entities/CalendarFollows';
import { Users } from '../entities/Users';
import { MailModule } from '../mail/mail.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CalendarEvents,
      CalendarAttendees,
      CalendarFollows,
      Users,
    ]),
    WorkspacesModule,
    DmsModule,
    MailModule,
  ],
  providers: [CalendarService],
  controllers: [CalendarController],
})
export class CalendarModule {}
