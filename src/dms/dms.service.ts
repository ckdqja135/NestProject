import { Injectable } from '@nestjs/common';
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

  async getDMUnreadsCount(url: string, id: number, myId: number, after: number) {
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
    // 받는 사람과 (다른 탭/기기에 접속한) 보낸 사람 모두에게 전송
    const namespace = `/ws-${url}`;
    const sockets = onlineMap[namespace] || {};
    const targets = [
      ...getKeysByValue(sockets, id),
      ...getKeysByValue(sockets, myId),
    ];
    if (targets.length) {
      this.eventsGateway.server.to(targets).emit('dm', dmWithSender);
    }
    return dmWithSender;
  }

  async createWorkspaceDMChats(
    url: string,
    content: string,
    id: number,
    myId: number,
  ) {
    const workspace = await this.findWorkspace(url, id, myId);
    await this.saveAndBroadcast(url, workspace.id, content, id, myId);
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
}
