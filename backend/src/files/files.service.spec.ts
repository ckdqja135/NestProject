import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChannelChats } from '../entities/ChannelChats';
import { ChannelMembers } from '../entities/ChannelMembers';
import { DMs } from '../entities/DMs';
import { EventsGateway } from '../events/events.gateway';
import { findFileMessage } from './find-file-message';
import { FilesService } from './files.service';

jest.mock('./find-file-message');
const mockedFind = findFileMessage as jest.MockedFunction<
  typeof findFileMessage
>;

describe('FilesService (받지 못한 파일 다시 보내기)', () => {
  let service: FilesService;
  const eventsGateway = { emitToUser: jest.fn() };
  const meta = { id: 'f1', name: 'a.pdf', type: 'application/pdf', size: 5 };
  const file = { size: 5, buffer: Buffer.from('hello') } as Express.Multer.File;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: getRepositoryToken(ChannelChats), useValue: {} },
        { provide: getRepositoryToken(DMs), useValue: {} },
        { provide: getRepositoryToken(ChannelMembers), useValue: {} },
        { provide: EventsGateway, useValue: eventsGateway },
      ],
    }).compile();
    service = module.get(FilesService);
  });

  const message = (canAccess = true) => ({
    meta,
    senderId: 1,
    canAccess: jest.fn().mockResolvedValue(canAccess),
  });

  it('원래 보낸 사람이 다시 보내면 요청한 사람에게만 중계한다', async () => {
    mockedFind.mockResolvedValue(message());
    await service.relayToRequester('shlack', 1, 'f1', 2, file);
    expect(eventsGateway.emitToUser).toHaveBeenCalledWith(
      'shlack',
      2,
      'fileData',
      {
        ...meta,
        data: file.buffer,
      },
    );
  });

  it('없는 파일이면 NotFoundException', async () => {
    mockedFind.mockResolvedValue(null);
    await expect(
      service.relayToRequester('shlack', 1, 'f1', 2, file),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('보낸 사람이 아니면 다시 보낼 수 없다', async () => {
    mockedFind.mockResolvedValue(message());
    await expect(
      service.relayToRequester('shlack', 3, 'f1', 2, file),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(eventsGateway.emitToUser).not.toHaveBeenCalled();
  });

  it('메시지를 볼 수 없는 사람에게는 보낼 수 없다', async () => {
    mockedFind.mockResolvedValue(message(false));
    await expect(
      service.relayToRequester('shlack', 1, 'f1', 9, file),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('크기가 다른 파일(바꿔치기)은 거부한다', async () => {
    mockedFind.mockResolvedValue(message());
    await expect(
      service.relayToRequester('shlack', 1, 'f1', 2, { ...file, size: 6 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
