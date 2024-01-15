import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { LoggerMiddleware } from './middlewares/logger.middleware';
import { UsersModule } from './users/users.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { ChannelsModule } from './channels/channels.module';
import { DmsModule } from './dms/dms.module';
import { UsersService } from './users/users.service';
import * as process from 'process';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users } from './entities/Users';
import { Channels } from './entities/Channels';
import { Dms } from './entities/Dms';
import { Channelchats } from './entities/Channelchats';
import { Mentions } from './entities/Mentions';
import { Workspaces } from './entities/Workspaces';
import { AuthModule } from './auth/auth.module';
import { WorkspaceMembers } from './entities/Workspacemembers';
import { ChannelMembers } from './entities/ChannelMembers';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    UsersModule,
    WorkspacesModule,
    ChannelsModule,
    DmsModule,
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: process.env.DB_USER,
      password: process.env.DB_PW,
      database: process.env.DB_NAME,
      // entities: [
      //   Channelchats,
      //   ChannelMembers,
      //   Channels,
      //   Dms,
      //   Mentions,
      //   Users,
      //   WorkspaceMembers,
      //   Workspaces,
      // ],
      synchronize: false,
      logging: true,
      keepConnectionAlive: true,
      migrations: [__dirname + '/src/migrations/*.ts'],
    }),
    TypeOrmModule.forFeature([
      Users,
      Workspaces,
      WorkspaceMembers,
      ChannelMembers,
    ]),
  ],
  controllers: [AppController],
  providers: [AppService, UsersService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
