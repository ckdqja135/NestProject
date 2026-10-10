import { DataSource, DataSourceOptions } from 'typeorm';
import { SeederOptions } from 'typeorm-extension';
import dotenv from 'dotenv';
import { ChannelChats } from './src/entities/ChannelChats';
import { ChannelMembers } from './src/entities/ChannelMembers';
import { Channels } from './src/entities/Channels';
import { DMs } from './src/entities/DMs';
import { DMReactions } from './src/entities/DMReactions';
import { SavedItems } from './src/entities/SavedItems';
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
