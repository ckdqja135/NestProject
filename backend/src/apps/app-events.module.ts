import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Apps } from '../entities/Apps';
import { ChannelMembers } from '../entities/ChannelMembers';
import { AppEventsService } from './app-events.service';

// 채널·DM 서비스가 앱 이벤트를 보낼 수 있게 어디서나 쓸 수 있도록 둔다 (모듈끼리 서로 의존하지 않게)
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Apps, ChannelMembers])],
  providers: [AppEventsService],
  exports: [AppEventsService],
})
export class AppEventsModule {}
