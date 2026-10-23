import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { LinksController } from './links.controller';
import { LinksService } from './links.service';

@Module({
  imports: [WorkspacesModule],
  providers: [LinksService],
  controllers: [LinksController],
})
export class LinksModule {}
