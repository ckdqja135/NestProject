import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelsModule } from '../channels/channels.module';
import { ChannelTabs } from '../entities/ChannelTabs';
import { Docs } from '../entities/Docs';
import { Users } from '../entities/Users';
import { DocActivityService } from './doc-activity.service';

// 문서·공동 편집 서비스가 채널 알림을 보낼 수 있게 어디서나 쓸 수 있도록 둔다 (모듈끼리 서로 의존하지 않게)
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([ChannelTabs, Docs, Users]),
    ChannelsModule,
  ],
  providers: [DocActivityService],
  exports: [DocActivityService],
})
export class DocActivityModule {}
