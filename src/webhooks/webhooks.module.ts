import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelsModule } from '../channels/channels.module';
import { Webhooks } from '../entities/Webhooks';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import {
  IncomingWebhooksController,
  WebhooksController,
} from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Webhooks]),
    ChannelsModule,
    WorkspacesModule,
  ],
  providers: [WebhooksService],
  controllers: [WebhooksController, IncomingWebhooksController],
})
export class WebhooksModule {}
