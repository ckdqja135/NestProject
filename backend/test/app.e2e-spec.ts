import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect(/Shlack API server/);
  });

  it('DB(.env 설정)에 연결되고 시드 데이터가 있다', async () => {
    const dataSource = app.get(DataSource);
    expect(dataSource.isInitialized).toBe(true);

    const [workspace] = await dataSource.query(
      'SELECT url FROM workspaces WHERE id = 1',
    );
    expect(workspace?.url).toBe('shlack');
  });
});
