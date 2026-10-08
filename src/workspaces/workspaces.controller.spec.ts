import { Test, TestingModule } from '@nestjs/testing';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

describe('WorkspacesController', () => {
  let controller: WorkspacesController;
  const workspacesService = {
    createWorkspace: jest.fn(),
    inviteMember: jest.fn(),
  };
  const user = { id: 1 } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkspacesController],
      providers: [{ provide: WorkspacesService, useValue: workspacesService }],
    }).compile();

    controller = module.get<WorkspacesController>(WorkspacesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('워크스페이스 생성 요청을 서비스에 위임한다', async () => {
    workspacesService.createWorkspace.mockResolvedValue({ id: 2 });
    await expect(
      controller.createWorkspace(user, { workspace: '테스트', url: 'test' }),
    ).resolves.toEqual({ id: 2 });
    expect(workspacesService.createWorkspace).toHaveBeenCalledWith(
      '테스트',
      'test',
      1,
    );
  });

  it('멤버 초대 후 ok 를 반환한다', async () => {
    await expect(
      controller.inviteMembersToWorkspace('sleact', { email: 'b@b.com' }, user),
    ).resolves.toBe('ok');
    expect(workspacesService.inviteMember).toHaveBeenCalledWith(
      'sleact',
      'b@b.com',
      1,
    );
  });
});
