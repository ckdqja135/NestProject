import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactStars } from '../entities/ContactStars';
import { Contacts } from '../entities/Contacts';
import { WorkspaceMembers } from '../entities/WorkspaceMembers';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contacts, ContactStars, WorkspaceMembers]),
    WorkspacesModule,
  ],
  providers: [ContactsService],
  controllers: [ContactsController],
})
export class ContactsModule {}
