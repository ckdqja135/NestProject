import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomEmojis } from '../entities/CustomEmojis';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { EmojisController } from './emojis.controller';
import { EmojisService } from './emojis.service';

@Module({
  imports: [TypeOrmModule.forFeature([CustomEmojis]), WorkspacesModule],
  providers: [EmojisService],
  controllers: [EmojisController],
})
export class EmojisModule {}
