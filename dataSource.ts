import { DataSource, DataSourceOptions } from 'typeorm';
import { SeederOptions } from 'typeorm-extension';
import dotenv from 'dotenv';
import { ChannelChats } from './src/entities/ChannelChats';
import { ChannelMembers } from './src/entities/ChannelMembers';
import { Channels } from './src/entities/Channels';
import { DMs } from './src/entities/DMs';
import { DMReactions } from './src/entities/DMReactions';
import { SavedItems } from './src/entities/SavedItems';
import { ScheduledMessages } from './src/entities/ScheduledMessages';
import { Reminders } from './src/entities/Reminders';
import { MessageEdits } from './src/entities/MessageEdits';
import { DMReads } from './src/entities/DMReads';
import { UserGroups } from './src/entities/UserGroups';
import { UserGroupMembers } from './src/entities/UserGroupMembers';
import { ReadMarkers } from './src/entities/ReadMarkers';
import { Drafts } from './src/entities/Drafts';
import { Webhooks } from './src/entities/Webhooks';
import { CustomEmojis } from './src/entities/CustomEmojis';
import { Docs } from './src/entities/Docs';
import { DocFolders } from './src/entities/DocFolders';
import { CalendarEvents } from './src/entities/CalendarEvents';
import { CalendarAttendees } from './src/entities/CalendarAttendees';
import { CalendarFollows } from './src/entities/CalendarFollows';
import { DocShares } from './src/entities/DocShares';
import { DocUserStates } from './src/entities/DocUserStates';
import { Mentions } from './src/entities/Mentions';
import { Reactions } from './src/entities/Reactions';
import { Users } from './src/entities/Users';
import { WorkspaceMembers } from './src/entities/WorkspaceMembers';
import { Workspaces } from './src/entities/Workspaces';

dotenv.config();

const options: DataSourceOptions & SeederOptions = {
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
    MessageEdits,
    DMReads,
    UserGroups,
    UserGroupMembers,
    ReadMarkers,
    Drafts,
    Webhooks,
    CustomEmojis,
    Docs,
    DocFolders,
    CalendarEvents,
    CalendarAttendees,
    CalendarFollows,
    DocShares,
    DocUserStates,
    Users,
    WorkspaceMembers,
    Workspaces,
  ],
  // 스키마 변경은 마이그레이션으로 관리한다 (npm run migration:generate → migration:run)
  migrations: ['src/migrations/*.ts'],
  seeds: ['src/database/seeds/*.ts'],
  charset: 'utf8mb4_general_ci',
  synchronize: false,
  logging: true,
};

const dataSource = new DataSource(options);

export default dataSource;
