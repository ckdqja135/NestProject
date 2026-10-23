import { Module } from '@nestjs/common';
import { DocsModule } from '../docs/docs.module';
import { CollabService } from './collab.service';

@Module({
  imports: [DocsModule],
  providers: [CollabService],
})
export class CollabModule {}
