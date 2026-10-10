import { Repository } from 'typeorm';
import { ChannelChats } from '../entities/ChannelChats';
import { ChannelMembers } from '../entities/ChannelMembers';
import { DMs } from '../entities/DMs';
import { FileMeta } from '../common/upload';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface FileMessage {
  meta: FileMeta;
  senderId: number;
  // 이 사용자가 파일 메시지를 볼 수 있는지 (채널 멤버 / DM 당사자)
  canAccess: (userId: number) => Promise<boolean>;
}

export interface FileMessageRepos {
  channelChats: Repository<ChannelChats>;
  dms: Repository<DMs>;
  channelMembers: Repository<ChannelMembers>;
}

// 워크스페이스(url) 안에서 파일 id 로 파일 메시지를 찾는다. 본문은 `file:{"id":"…",…}` 형식.
export async function findFileMessage(
  repos: FileMessageRepos,
  url: string,
  fileId: string,
): Promise<FileMessage | null> {
  if (!UUID_PATTERN.test(fileId || '')) {
    return null;
  }
  const prefix = `file:{"id":"${fileId}"%`;
  const chat = await repos.channelChats
    .createQueryBuilder('chat')
    .innerJoin('chat.Channel', 'channel')
    .innerJoin('channel.Workspace', 'workspace', 'workspace.url = :url', {
      url,
    })
    .where('chat.content LIKE :prefix', { prefix })
    .getOne();
  if (chat) {
    return {
      meta: JSON.parse(chat.content.slice(5)),
      senderId: chat.UserId,
      canAccess: async (userId) =>
        !!(await repos.channelMembers.findOne({
          where: { ChannelId: chat.ChannelId, UserId: userId },
        })),
    };
  }
  const dm = await repos.dms
    .createQueryBuilder('dm')
    .innerJoin('dm.Workspace', 'workspace', 'workspace.url = :url', { url })
    .where('dm.content LIKE :prefix', { prefix })
    .getOne();
  if (dm) {
    return {
      meta: JSON.parse(dm.content.slice(5)),
      senderId: dm.SenderId,
      canAccess: async (userId) =>
        userId === dm.SenderId || userId === dm.ReceiverId,
    };
  }
  return null;
}
