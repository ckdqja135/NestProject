import { ForbiddenException } from '@nestjs/common';
import { ApprovalsService } from './approvals.service';

// 결재 진행: 차례대로 승인, 반려하면 끝, 차례가 아니면 못 한다
describe('ApprovalsService', () => {
  let approval: Record<string, any>;
  let steps: Record<string, any>[];
  const approvalsRepository = {
    findOne: jest.fn(() =>
      Promise.resolve({ ...approval, Steps: steps.map((s) => ({ ...s })) }),
    ),
    update: jest.fn((id, v) => {
      Object.assign(approval, v);
      return Promise.resolve();
    }),
  };
  const stepsRepository = {
    update: jest.fn((id, v) => {
      Object.assign(steps.find((s) => s.id === id) as object, v);
      return Promise.resolve();
    }),
  };
  const usersRepository = {
    findOne: jest.fn(({ where }) =>
      Promise.resolve({ id: where.id, nickname: `사람${where.id}` }),
    ),
    find: jest.fn(() => Promise.resolve([])),
  };
  const workspacesService = {
    findWorkspaceByUrl: jest.fn().mockResolvedValue({ id: 1 }),
    assertMember: jest.fn().mockResolvedValue('member'),
  };
  const dmsService = { createWorkspaceDMChats: jest.fn() };
  const botsService = { ensureMember: jest.fn().mockResolvedValue(77) };
  const emit = jest.fn();
  const eventsGateway = {
    emitToUser: jest.fn(),
    server: { to: jest.fn(() => ({ emit })) },
  };
  const service = new ApprovalsService(
    approvalsRepository as never,
    stepsRepository as never,
    usersRepository as never,
    {} as never,
    { findOne: jest.fn() } as never,
    workspacesService as never,
    {} as never,
    dmsService as never,
    botsService as never,
    eventsGateway as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    approval = {
      id: 3,
      title: '노트북 구매',
      kind: 'purchase',
      status: 'pending',
      RequesterId: 5,
      ChannelId: 2,
      PeerId: null,
    };
    steps = [
      { id: 10, position: 0, ApproverId: 6, status: 'pending' },
      { id: 11, position: 1, ApproverId: 7, status: 'waiting' },
    ];
  });

  it('첫 결재자가 승인하면 다음 사람 차례가 되고 봇이 알린다', async () => {
    await service.decide('ws', 3, 'approve', undefined, 6);
    expect(steps.map((s) => s.status)).toEqual(['approved', 'pending']);
    expect(approval.status).toBe('pending');
    expect(dmsService.createWorkspaceDMChats.mock.calls[0][2]).toBe(7);
    expect(emit).toHaveBeenCalledWith('approvalUpdated', { id: 3 });
  });

  it('마지막 결재자가 승인하면 승인으로 끝나고 요청자에게 알린다', async () => {
    steps[0].status = 'approved';
    steps[1].status = 'pending';
    await service.decide('ws', 3, 'approve', undefined, 7);
    expect(approval.status).toBe('approved');
    expect(dmsService.createWorkspaceDMChats.mock.calls[0][2]).toBe(5);
  });

  it('반려하면 남은 단계는 건너뛰고 사유를 요청자에게 알린다', async () => {
    await service.decide('ws', 3, 'reject', '예산 초과', 6);
    expect(approval.status).toBe('rejected');
    expect(steps.map((s) => s.status)).toEqual(['rejected', 'skipped']);
    expect(dmsService.createWorkspaceDMChats.mock.calls[0][1]).toContain(
      '예산 초과',
    );
  });

  it('내 차례가 아니면 결재할 수 없다', async () => {
    await expect(
      service.decide('ws', 3, 'approve', undefined, 7),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.cancel('ws', 3, 6)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
