import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Drafts } from '../entities/Drafts';
import { ReadMarkers } from '../entities/ReadMarkers';
import { EventsGateway } from '../events/events.gateway';
import { WorkspacesService } from '../workspaces/workspaces.service';

// 기기 간 동기화: 어디까지 읽었는지, 쓰다 만 메시지
@Injectable()
export class SyncService {
  constructor(
    @InjectRepository(ReadMarkers)
    private markersRepository: Repository<ReadMarkers>,
    @InjectRepository(Drafts)
    private draftsRepository: Repository<Drafts>,
    private workspacesService: WorkspacesService,
    private eventsGateway: EventsGateway,
  ) {}

  private async findWorkspace(url: string, myId: number) {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    await this.workspacesService.assertMember(workspace.id, myId);
    return workspace;
  }

  async getSync(url: string, myId: number) {
    const workspace = await this.findWorkspace(url, myId);
    const where = { UserId: myId, WorkspaceId: workspace.id };
    const [markers, drafts] = await Promise.all([
      this.markersRepository.find({ where }),
      this.draftsRepository.find({ where }),
    ]);
    return {
      readMarkers: Object.fromEntries(
        markers.map((m) => [m.key, m.lastReadAt.getTime()]),
      ),
      drafts: Object.fromEntries(
        drafts.map((d) => [
          d.key,
          { content: d.content, at: d.updatedAt.getTime() },
        ]),
      ),
    };
  }

  // 읽은 시각은 앞으로만 간다. 바뀌면 내 다른 기기에 알린다.
  async putReadMarker(url: string, key: string, at: number, myId: number) {
    const workspace = await this.findWorkspace(url, myId);
    // 기기 시계가 앞서 있어도 서버 시각보다 미래로는 기록하지 않는다
    const time = Math.min(at, Date.now());
    const where = { UserId: myId, WorkspaceId: workspace.id, key };
    const existing = await this.markersRepository.findOne({ where });
    if (existing && existing.lastReadAt.getTime() >= time) {
      return { key, at: existing.lastReadAt.getTime() };
    }
    await this.markersRepository.save({ ...where, lastReadAt: new Date(time) });
    this.eventsGateway.emitToUser(url, myId, 'readMarker', { key, at: time });
    // 채널을 읽었으면 그 채널을 보는 사람들의 "몇 명 읽음"도 바꾼다 (채널 멤버일 때만)
    const channelId = /^c:(\d+)$/.exec(key)?.[1];
    if (channelId) {
      const member = await this.markersRepository.manager.query(
        `SELECT 1 FROM channelmembers cm JOIN channels c ON c.id = cm.ChannelId
          WHERE cm.ChannelId = ? AND cm.UserId = ? AND c.WorkspaceId = ? LIMIT 1`,
        [Number(channelId), myId, workspace.id],
      );
      if (member.length) {
        this.eventsGateway.server
          .to(`/ws-${url}-${channelId}`)
          .emit('channelRead', {
            channelId: Number(channelId),
            userId: myId,
            at: time,
          });
      }
    }
    return { key, at: time };
  }

  // 나중에 고친 쪽이 이긴다. 빈 내용이면 지운다.
  async putDraft(
    url: string,
    key: string,
    content: string,
    at: number,
    myId: number,
  ) {
    const workspace = await this.findWorkspace(url, myId);
    const time = Math.min(at, Date.now());
    const where = { UserId: myId, WorkspaceId: workspace.id, key };
    const existing = await this.draftsRepository.findOne({ where });
    if (existing && existing.updatedAt.getTime() > time) {
      return {
        key,
        content: existing.content,
        at: existing.updatedAt.getTime(),
      };
    }
    if (content.trim()) {
      await this.draftsRepository.save({
        ...where,
        content,
        updatedAt: new Date(time),
      });
    } else if (existing) {
      await this.draftsRepository.delete(where);
    }
    return { key, content, at: time };
  }
}
