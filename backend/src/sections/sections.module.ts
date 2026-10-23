import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelMembers } from '../entities/ChannelMembers';
import { SidebarSectionItems } from '../entities/SidebarSectionItems';
import { SidebarSections } from '../entities/SidebarSections';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { SectionsController } from './sections.controller';
import { SectionsService } from './sections.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SidebarSections,
      SidebarSectionItems,
      ChannelMembers,
    ]),
    WorkspacesModule,
  ],
  providers: [SectionsService],
  controllers: [SectionsController],
})
export class SectionsModule {}
