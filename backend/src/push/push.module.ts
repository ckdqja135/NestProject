import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSettings } from '../entities/AppSettings';
import { PushSubscriptions } from '../entities/PushSubscriptions';
import { Users } from '../entities/Users';
import { PushController } from './push.controller';
import { PushService } from './push.service';

// 멘션·DM 을 보내는 곳 어디서나 쓰도록 전역으로 둔다
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([PushSubscriptions, AppSettings, Users])],
  providers: [PushService],
  controllers: [PushController],
  exports: [PushService],
})
export class PushModule {}
