import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChannelsService } from '../channels/channels.service';
import { DmsService } from '../dms/dms.service';
import { ChannelChats } from '../entities/ChannelChats';
import { ChannelMembers } from '../entities/ChannelMembers';
import { DMs } from '../entities/DMs';
import { WorkspacesService } from '../workspaces/workspaces.service';

export const MAX_FORWARD_COMMENT = 4000;
const MAX_SNAPSHOT = 4000;

// 전달한 메시지: 내용은 fwd:{"c":"덧붙인 말","m":{원본 요약}} 으로 저장한다.
// 원본은 전달한 순간의 모습을 복사해 두고(원본이 바뀌거나 지워져도 그대로), 원본의 멘션은 다시 알림이 가지 않게 글자로 바꾼다.
export interface ForwardedSnapshot {
  a: string; // 원래 보낸 사람
  ai: number | null;
  ch: string | null; // 채널 이름 (DM 이면 null)
  at: string; // 원래 보낸 시각
  t: string; // 원래 내용 (멘션은 @닉네임 글자로)
  l: string | null; // 원본으로 가는 주소 (채널 메시지만)
}

export const toForwardContent = (
  comment: string,
  snapshot: ForwardedSnapshot,
) => `fwd:${JSON.stringify({ c: comment, m: snapshot })}`;

const plainMentions = (text: string) =>
  text.replace(/@\[(.+?)]\((\d+|channel|here|g\d+)\)/g, '@$1');

export type ForwardSource = { source: 'chat' | 'dm'; id: number };
export type ForwardTarget =
  | { to: 'channel'; target: string }
  | { to: 'dm'; target: number };

@Injectable()
export class ForwardService {
  constructor(
    @InjectRepository(ChannelChats)
    private channelChatsRepository: Repository<ChannelChats>,
    @InjectRepository(ChannelMembers)
    private channelMembersRepository: Repository<ChannelMembers>,
    @InjectRepository(DMs)
    private dmsRepository: Repository<DMs>,
    private workspacesService: WorkspacesService,
    private channelsService: ChannelsService,
    private dmsService: DmsService,
  ) {}

  // 내가 볼 수 있는 원본을 찾아 요약을 만든다
  async snapshot(
    url: string,
    workspaceId: number,
    { source, id }: ForwardSource,
    myId: number,
  ): Promise<ForwardedSnapshot> {
    let content: string;
    let author: { id: number | null; name: string };
    let at: Date;
    let channelName: string | null = null;
    let link: string | null = null;
    if (source === 'chat') {
      const chat = await this.channelChatsRepository.findOne({
        where: { id },
        relations: ['Channel', 'User'],
      });
      const member =
        chat?.Channel?.WorkspaceId === workspaceId &&
        (await this.channelMembersRepository.findOne({
          where: { ChannelId: chat.ChannelId, UserId: myId },
        }));
      if (!chat || !member) {
        throw new NotFoundException('존재하지 않는 메시지입니다.');
      }
      content = chat.content;
      author = {
        id: chat.UserId ?? null,
        name: chat.User?.nickname || chat.botName || '알 수 없음',
      };
      at = chat.createdAt;
      channelName = chat.Channel.name;
      const query = chat.ParentId
        ? `message=${chat.ParentId}&reply=${chat.id}`
        : `message=${chat.id}`;
      link = `/workspace/${url}/channel/${encodeURIComponent(
        chat.Channel.name,
      )}?${query}`;
    } else {
      const dm = await this.dmsRepository.findOne({
        where: { id, WorkspaceId: workspaceId },
        relations: ['Sender'],
      });
      if (!dm || (dm.SenderId !== myId && dm.ReceiverId !== myId)) {
        throw new NotFoundException('존재하지 않는 메시지입니다.');
      }
      content = dm.content;
      author = { id: dm.SenderId, name: dm.Sender?.nickname || '알 수 없음' };
      at = dm.createdAt;
    }
    // 파일은 보낸 사람 기기에서만 받을 수 있고, 투표는 원래 자리에서만 투표할 수 있다
    if (content.startsWith('file:') || content.startsWith('poll:')) {
      throw new BadRequestException('파일·투표 메시지는 전달할 수 없습니다.');
    }
    // 전달한 메시지를 다시 전달하면 원래 메시지를 전달한다
    if (content.startsWith('fwd:')) {
      try {
        const inner = JSON.parse(content.slice(4));
        if (inner?.m?.t !== undefined) {
          return inner.m as ForwardedSnapshot;
        }
      } catch {
        // 형식이 다르면 글자 그대로
      }
    }
    return {
      a: author.name,
      ai: author.id,
      ch: channelName,
      at: at.toISOString(),
      t: plainMentions(content).slice(0, MAX_SNAPSHOT),
      l: link,
    };
  }

  async forward(
    url: string,
    source: ForwardSource,
    target: ForwardTarget,
    comment: string,
    myId: number,
  ) {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    await this.workspacesService.assertMember(workspace.id, myId);
    const snapshot = await this.snapshot(url, workspace.id, source, myId);
    const content = toForwardContent(
      comment.trim().slice(0, MAX_FORWARD_COMMENT),
      snapshot,
    );
    // 보낼 곳의 권한(채널 멤버인지, 보관된 채널인지 등)은 원래 보내기와 같은 규칙으로 확인한다
    if (target.to === 'channel') {
      return this.channelsService.postChat(url, target.target, content, myId);
    }
    return this.dmsService.createWorkspaceDMChats(
      url,
      content,
      target.target,
      myId,
    );
  }
}
