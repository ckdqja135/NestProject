import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocFolders } from '../entities/DocFolders';
import { Docs } from '../entities/Docs';
import { DocShares } from '../entities/DocShares';
import { DocUserStates } from '../entities/DocUserStates';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { DocsController } from './docs.controller';
import { DocsService } from './docs.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Docs, DocFolders, DocShares, DocUserStates]),
    WorkspacesModule,
  ],
  providers: [DocsService],
  controllers: [DocsController],
})
export class DocsModule {}
