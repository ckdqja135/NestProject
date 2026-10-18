import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChannelChats } from '../entities/ChannelChats';
import { ChannelMembers } from '../entities/ChannelMembers';
import { DMs } from '../entities/DMs';
import { EventsGateway } from '../events/events.gateway';
import { findFileMessage } from './find-file-message';

@Injectable()
export class FilesService {
  constructor(
    @InjectRepository(ChannelChats)
    private channelChatsRepository: Repository<ChannelChats>,
    @InjectRepository(DMs) private dmsRepository: Repository<DMs>,
    @InjectRepository(ChannelMembers)
    private channelMembersRepository: Repository<ChannelMembers>,
    private eventsGateway: EventsGateway,
  ) {}

  // 보낸 사람 브라우저가 다시 보낸 파일을 요청한 사람에게만 중계한다 (디스크 저장 없음)
  async relayToRequester(
    url: string,
    uploaderId: number,
    fileId: string,
    requesterId: number,
    file: Express.Multer.File,
  ) {
    const message = await findFileMessage(
      {
        channelChats: this.channelChatsRepository,
        dms: this.dmsRepository,
        channelMembers: this.channelMembersRepository,
      },
      url,
      fileId,
    );
    if (!message) {
      throw new NotFoundException('존재하지 않는 파일입니다.');
    }
    // 원래 보낸 사람만 다시 보낼 수 있고, 받는 사람은 그 메시지를 볼 수 있어야 한다
    if (
      message.senderId !== uploaderId ||
      !(await message.canAccess(requesterId))
    ) {
      throw new ForbiddenException('이 파일을 전달할 수 없습니다.');
    }
    // 다른 파일로 바꿔치기하지 못하도록 크기가 원래 파일과 같아야 한다
    if (!file || file.size !== message.meta.size) {
      throw new ForbiddenException('원래 파일과 다릅니다.');
    }
    this.eventsGateway.emitToUser(url, requesterId, 'fileData', {
      ...message.meta,
      data: file.buffer,
    });
  }
}
