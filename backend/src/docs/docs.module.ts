import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocFolders } from '../entities/DocFolders';
import { Docs } from '../entities/Docs';
import { DocShares } from '../entities/DocShares';
import { DocUserStates } from '../entities/DocUserStates';
import { DocLinks } from '../entities/DocLinks';
import { DocComments } from '../entities/DocComments';
import { DocAccessRequests } from '../entities/DocAccessRequests';
import { Users } from '../entities/Users';
import { BotsModule } from '../bots/bots.module';
import { DmsModule } from '../dms/dms.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { DocsController } from './docs.controller';
import { DocsService } from './docs.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Docs,
      DocFolders,
      DocShares,
      DocUserStates,
      DocLinks,
      DocComments,
      DocAccessRequests,
      Users,
    ]),
    WorkspacesModule,
    BotsModule,
    DmsModule,
  ],
  providers: [DocsService],
  controllers: [DocsController],
  exports: [DocsService],
})
export class DocsModule {}
