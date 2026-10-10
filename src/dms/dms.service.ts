import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { DMs } from '../entities/DMs';
import { DMReactions } from '../entities/DMReactions';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { EventsGateway } from '../events/events.gateway';
import { onlineMap } from '../events/onlineMap';
import { toFileContent, toFileMeta } from '../common/upload';

function getKeysByValue(object: Record<string, number>, value: number) {
  return Object.keys(object).filter((key) => object[key] === value);
}

@Injectable()
export class DmsService {
  constructor(
    @InjectRepository(DMs) private dmsRepository: Repository<DMs>,
    @InjectRepository(DMReactions)
    private dmReactionsRepository: Repository<DMReactions>,
    private workspacesService: WorkspacesService,
    private eventsGateway: EventsGateway,
  ) {}

  private async findWorkspace(url: string, otherId: number, myId: number) {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    await this.workspacesService.assertMember(workspace.id, myId);
    await this.workspacesService.assertMember(workspace.id, otherId);
    return workspace;
  }

  // beforeId 가 있으면 그 메시지보다 오래된 것을 가져온다 (커서 방식)
  async getWorkspaceDMChats(
    url: string,
    id: number,
    myId: number,
    perPage: number,
    page: number,
    beforeId?: number,
  ) {
    const workspace = await this.findWorkspace(url, id, myId);
    const query = this.dmsRepository
      .createQueryBuilder('dms')
      .innerJoinAndSelect('dms.Sender', 'sender')
      .innerJoinAndSelect('dms.Receiver', 'receiver')
      .leftJoinAndSelect('dms.Reactions', 'reactions')
      .where('dms.WorkspaceId = :workspaceId', { workspaceId: workspace.id })
      .andWhere(
        '((dms.SenderId = :myId AND dms.ReceiverId = :id) OR (dms.ReceiverId = :myId AND dms.SenderId = :id))',
        { id, myId },
      )
      .orderBy('dms.id', 'DESC')
      .take(perPage);
    if (beforeId) {
      query.andWhere('dms.id < :beforeId', { beforeId });
    } else {
      query.skip(perPage * (page - 1));
    }
    return query.getMany();
  }

  async getDMUnreadsCount(
    url: string,
    id: number,
    myId: number,
    after: number,
  ) {
    const workspace = await this.findWorkspace(url, id, myId);
    return this.dmsRepository.count({
      where: {
        WorkspaceId: workspace.id,
        SenderId: id,
        ReceiverId: myId,
        createdAt: MoreThan(new Date(after)),
      },
    });
  }

  // 받는 사람과 (다른 탭/기기에 접속한) 보낸 사람 모두에게 전송
  private emitToPair(
    url: string,
    userA: number,
    userB: number,
    event: string,
    data,
  ) {
    const sockets = onlineMap[`/ws-${url}`] || {};
    const targets = [
      ...getKeysByValue(sockets, userA),
      ...getKeysByValue(sockets, userB),
    ];
    if (targets.length) {
      this.eventsGateway.server.to(targets).emit(event, data);
    }
  }

  private async saveAndBroadcast(
    url: string,
    workspaceId: number,
    content: string,
    id: number,
    myId: number,
  ) {
    const saved = await this.dmsRepository.save({
      content,
      SenderId: myId,
      ReceiverId: id,
      WorkspaceId: workspaceId,
    });
    const dmWithSender = await this.dmsRepository.findOne({
      where: { id: saved.id },
      relations: ['Sender', 'Receiver', 'Reactions'],
    });
    this.emitToPair(url, id, myId, 'dm', dmWithSender);
    return dmWithSender;
  }

  async createWorkspaceDMChats(
    url: string,
    content: string,
    id: number,
    myId: number,
  ) {
    const workspace = await this.findWorkspace(url, id, myId);
    return this.saveAndBroadcast(url, workspace.id, content, id, myId);
  }

  // 파일 전송: DM 에는 파일 정보만 저장하고, 파일 내용은 디스크에 쓰지 않고 두 사람의 접속 중인 탭으로 중계한다
  async sendDMFiles(
    url: string,
    files: Express.Multer.File[],
    clientIds: string[],
    id: number,
    myId: number,
  ) {
    const workspace = await this.findWorkspace(url, id, myId);
    const dms = [];
    for (const [index, file] of files.entries()) {
      const meta = toFileMeta(file, clientIds[index]);
      dms.push(
        await this.saveAndBroadcast(
          url,
          workspace.id,
          toFileContent(meta),
          id,
          myId,
        ),
      );
      this.emitToPair(url, id, myId, 'fileData', {
        ...meta,
        data: file.buffer,
      });
    }
    return dms;
  }

  // 상대(id)와 나눈 대화의 메시지(dmId)를 찾는다
  private async findConversationDM(
    url: string,
    id: number,
    dmId: number,
    myId: number,
  ) {
    const workspace = await this.findWorkspace(url, id, myId);
    const dm = await this.dmsRepository.findOne({
      where: { id: dmId, WorkspaceId: workspace.id },
    });
    const isConversation =
      dm &&
      ((dm.SenderId === myId && dm.ReceiverId === id) ||
        (dm.SenderId === id && dm.ReceiverId === myId));
    if (!isConversation) {
      throw new NotFoundException('존재하지 않는 메시지입니다.');
    }
    return dm;
  }

  // 상대(id)와 나눈 DM 중 내가 보낸 메시지(dmId)를 찾는다
  private async findMyDM(url: string, id: number, dmId: number, myId: number) {
    const dm = await this.findConversationDM(url, id, dmId, myId);
    if (dm.SenderId !== myId) {
      throw new ForbiddenException(
        '내가 보낸 메시지만 수정/삭제할 수 있습니다.',
      );
    }
    return dm;
  }

  async editDM(
    url: string,
    id: number,
    dmId: number,
    content: string,
    myId: number,
  ) {
    const dm = await this.findMyDM(url, id, dmId, myId);
    await this.dmsRepository.update(dm.id, { content, editedAt: new Date() });
    const updated = await this.dmsRepository.findOne({
      where: { id: dm.id },
      relations: ['Sender', 'Receiver', 'Reactions'],
    });
    this.emitToPair(url, id, myId, 'dmUpdated', updated);
    return updated;
  }

  async deleteDM(url: string, id: number, dmId: number, myId: number) {
    const dm = await this.findMyDM(url, id, dmId, myId);
    await this.dmsRepository.delete(dm.id);
    this.emitToPair(url, id, myId, 'dmDeleted', {
      id: dm.id,
      SenderId: dm.SenderId,
      ReceiverId: dm.ReceiverId,
    });
  }

  // 이모지 리액션 토글 (대화 상대 둘 다 가능)
  async toggleReaction(
    url: string,
    id: number,
    dmId: number,
    emoji: string,
    myId: number,
  ) {
    const dm = await this.findConversationDM(url, id, dmId, myId);
    const existing = await this.dmReactionsRepository.findOne({
      where: { DMId: dm.id, UserId: myId, emoji },
    });
    if (existing) {
      await this.dmReactionsRepository.delete(existing.id);
    } else {
      await this.dmReactionsRepository.save({
        DMId: dm.id,
        UserId: myId,
        emoji,
      });
    }
    const reactions = await this.dmReactionsRepository.find({
      where: { DMId: dm.id },
      order: { id: 'ASC' },
    });
    const payload = {
      id: dm.id,
      SenderId: dm.SenderId,
      ReceiverId: dm.ReceiverId,
      Reactions: reactions,
    };
    this.emitToPair(url, id, myId, 'dmReactionUpdated', payload);
    return payload;
  }

  // 메시지 고정/해제 (대화 상대 둘 다 가능)
  async setPinned(
    url: string,
    id: number,
    dmId: number,
    pinned: boolean,
    myId: number,
  ) {
    const dm = await this.findConversationDM(url, id, dmId, myId);
    await this.dmsRepository.update(dm.id, { pinned });
    const updated = await this.dmsRepository.findOne({
      where: { id: dm.id },
      relations: ['Sender', 'Receiver', 'Reactions'],
    });
    this.emitToPair(url, id, myId, 'dmUpdated', updated);
    return updated;
  }

  async getPinnedDMs(url: string, id: number, myId: number) {
    const workspace = await this.findWorkspace(url, id, myId);
    return this.dmsRepository
      .createQueryBuilder('dms')
      .innerJoinAndSelect('dms.Sender', 'sender')
      .innerJoinAndSelect('dms.Receiver', 'receiver')
      .leftJoinAndSelect('dms.Reactions', 'reactions')
      .where('dms.WorkspaceId = :workspaceId', { workspaceId: workspace.id })
      .andWhere(
        '((dms.SenderId = :myId AND dms.ReceiverId = :id) OR (dms.ReceiverId = :myId AND dms.SenderId = :id))',
        { id, myId },
      )
      .andWhere('dms.pinned = :pinned', { pinned: true })
      .orderBy('dms.createdAt', 'DESC')
      .getMany();
  }
}
