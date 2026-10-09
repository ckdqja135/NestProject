import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { DMs } from '../entities/DMs';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { EventsGateway } from '../events/events.gateway';
import { onlineMap } from '../events/onlineMap';

function getKeysByValue(object: Record<string, number>, value: number) {
  return Object.keys(object).filter((key) => object[key] === value);
}

@Injectable()
export class DmsService {
  constructor(
    @InjectRepository(DMs) private dmsRepository: Repository<DMs>,
    private workspacesService: WorkspacesService,
    private eventsGateway: EventsGateway,
  ) {}

  private async findWorkspace(url: string, otherId: number, myId: number) {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    await this.workspacesService.assertMember(workspace.id, myId);
    await this.workspacesService.assertMember(workspace.id, otherId);
    return workspace;
  }

  async getWorkspaceDMChats(
    url: string,
    id: number,
    myId: number,
    perPage: number,
    page: number,
  ) {
    const workspace = await this.findWorkspace(url, id, myId);
    return this.dmsRepository
      .createQueryBuilder('dms')
      .innerJoinAndSelect('dms.Sender', 'sender')
      .innerJoinAndSelect('dms.Receiver', 'receiver')
      .where('dms.WorkspaceId = :workspaceId', { workspaceId: workspace.id })
      .andWhere(
        '((dms.SenderId = :myId AND dms.ReceiverId = :id) OR (dms.ReceiverId = :myId AND dms.SenderId = :id))',
        { id, myId },
      )
      .orderBy('dms.createdAt', 'DESC')
      .addOrderBy('dms.id', 'DESC')
      .take(perPage)
      .skip(perPage * (page - 1))
      .getMany();
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
      relations: ['Sender', 'Receiver'],
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

  async createWorkspaceDMImages(
    url: string,
    files: Express.Multer.File[],
    id: number,
    myId: number,
  ) {
    const workspace = await this.findWorkspace(url, id, myId);
    for (const file of files) {
      await this.saveAndBroadcast(
        url,
        workspace.id,
        file.path.replace(/\\/g, '/'),
        id,
        myId,
      );
    }
  }

  // 상대(id)와 나눈 DM 중 내가 보낸 메시지(dmId)를 찾는다
  private async findMyDM(url: string, id: number, dmId: number, myId: number) {
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
    await this.dmsRepository.update(dm.id, { content });
    const updated = await this.dmsRepository.findOne({
      where: { id: dm.id },
      relations: ['Sender', 'Receiver'],
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
}
