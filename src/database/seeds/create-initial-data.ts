import { Seeder } from 'typeorm-extension';
import { DataSource } from 'typeorm';
import { Workspaces } from '../../entities/Workspaces';
import { Channels } from '../../entities/Channels';

// 회원가입 시 자동으로 가입되는 기본 워크스페이스(id: 1)와 기본 채널(id: 1)
export default class InitialDataSeeder implements Seeder {
  public async run(dataSource: DataSource): Promise<any> {
    await dataSource.getRepository(Workspaces).save({
      id: 1,
      name: 'Sleact',
      url: 'sleact',
    });
    await dataSource.getRepository(Channels).save({
      id: 1,
      name: '일반',
      WorkspaceId: 1,
      private: false,
    });
  }
}
