import { MiddlewareConsumer, Module } from '@nestjs/common';
import { SavedModule } from './saved/saved.module';
import { ScheduledModule } from './scheduled/scheduled.module';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { rateLimitPerMinute } from './security';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { LoggerMiddleware } from './middlewares/logger.middleware';
import { UsersModule } from './users/users.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { ChannelsModule } from './channels/channels.module';
import { DmsModule } from './dms/dms.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { SearchModule } from './search/search.module';
import { GifsModule } from './gifs/gifs.module';
import { MentionsModule } from './mentions/mentions.module';
import { FilesModule } from './files/files.module';
import { ChannelChats } from './entities/ChannelChats';
import { ChannelMembers } from './entities/ChannelMembers';
import { Channels } from './entities/Channels';
import { DMs } from './entities/DMs';
import { DMReactions } from './entities/DMReactions';
import { SavedItems } from './entities/SavedItems';
import { ScheduledMessages } from './entities/ScheduledMessages';
import { Reminders } from './entities/Reminders';
import { Mentions } from './entities/Mentions';
import { Reactions } from './entities/Reactions';
import { Users } from './entities/Users';
import { WorkspaceMembers } from './entities/WorkspaceMembers';
import { Workspaces } from './entities/Workspaces';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // IP 별 요청 수 제한 (로그인 등은 컨트롤러에서 더 엄격하게)
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: rateLimitPerMinute }],
      errorMessage: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    }),
    TypeOrmModule.forRoot({
      type: 'mariadb',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      username: process.env.DB_USER,
      password: process.env.DB_PW,
      database: process.env.DB_NAME,
      entities: [
        ChannelChats,
        ChannelMembers,
        Channels,
        DMs,
        DMReactions,
        Mentions,
        Reactions,
        SavedItems,
        ScheduledMessages,
        Reminders,
        Users,
        WorkspaceMembers,
        Workspaces,
      ],
      charset: 'utf8mb4_general_ci',
      synchronize: false,
      logging: process.env.NODE_ENV !== 'production',
      keepConnectionAlive: true,
    }),
    AuthModule,
    UsersModule,
    WorkspacesModule,
    ChannelsModule,
    DmsModule,
    EventsModule,
    SearchModule,
    GifsModule,
    SavedModule,
    ScheduledModule,
    MentionsModule,
    FilesModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
