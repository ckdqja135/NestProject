import { IUser } from '@typings/db';
import getErrorMessage from '@utils/getErrorMessage';
import { toPollContent } from '@utils/poll';
import { parseCommand, parsePollArgs, parseRemindTime, parseStatusArgs, SLASH_COMMANDS } from '@utils/slashCommands';
import { formatWhen } from '@utils/timePresets';
import axios from 'axios';
import { useCallback } from 'react';
import { toast } from 'react-toastify';
import { mutate } from 'swr';

interface Options {
  workspace: string;
  me?: IUser;
  channel?: string; // 채널에서 쓰면 채널 이름
  sendMessage: (content: string) => void;
}

const info = (message: string) => toast.info(message, { position: 'bottom-center' });
const fail = (error: unknown) => toast.error(getErrorMessage(error), { position: 'bottom-center' });

// 입력창의 '/명령' 을 처리한다. 명령이면 true (입력창을 비운다), 아니면 false (그냥 메시지로 보낸다)
export default function useSlashCommands({ workspace, me, channel, sendMessage }: Options) {
  return useCallback(
    (text: string): boolean => {
      const command = parseCommand(text);
      if (!command || !me) {
        return false;
      }
      const { name, args } = command;
      const known = SLASH_COMMANDS.find((c) => c.name === name);
      if (!known) {
        toast.error(`알 수 없는 명령입니다: /${name} (/help 로 목록 보기)`, { position: 'bottom-center' });
        return true;
      }
      if (known.channelOnly && !channel) {
        toast.error(`/${name} 은 채널에서만 쓸 수 있습니다.`, { position: 'bottom-center' });
        return true;
      }
      const channelUrl = channel ? `/api/workspaces/${workspace}/channels/${encodeURIComponent(channel)}` : '';
      switch (name) {
        case 'help':
          toast.info(
            SLASH_COMMANDS.filter((c) => channel || !c.channelOnly)
              .map((c) => `${c.usage} — ${c.description}`)
              .join('\n'),
            { position: 'bottom-center', autoClose: 15000, style: { whiteSpace: 'pre-line' } },
          );
          return true;
        case 'remind': {
          const parsed = parseRemindTime(args);
          if (!parsed || !parsed.rest) {
            toast.error('예: /remind 30분 회의 준비, /remind 내일 9시 보고서', { position: 'bottom-center' });
            return true;
          }
          // 나에게 보내는 메모로 남기고, 그 메모에 리마인더를 건다
          axios
            .post(`/api/workspaces/${workspace}/dms/${me.id}/chats`, { content: `⏰ ${parsed.rest}` })
            .then(({ data }) =>
              axios.post(`/api/workspaces/${workspace}/reminders`, {
                dmId: data.id,
                remindAt: parsed.date.toISOString(),
              }),
            )
            .then(() => info(`${formatWhen(parsed.date)}에 알려드릴게요: ${parsed.rest}`))
            .catch(fail);
          return true;
        }
        case 'poll': {
          const poll = parsePollArgs(args);
          if (!poll) {
            toast.error('예: /poll 점심? | 국밥 | 짜장 (선택지 2개 이상)', { position: 'bottom-center' });
            return true;
          }
          sendMessage(toPollContent(poll));
          return true;
        }
        case 'status': {
          const status = args ? parseStatusArgs(args) : null;
          axios
            .patch(
              '/api/users/me',
              status
                ? { statusEmoji: status.emoji, statusText: status.text || null }
                : { statusEmoji: null, statusText: null },
            )
            .then(() => {
              mutate('/api/users');
              info(status ? `상태: ${status.emoji} ${status.text}` : '상태를 지웠습니다.');
            })
            .catch(fail);
          return true;
        }
        case 'away':
        case 'back':
          axios
            .patch('/api/users/me', { away: name === 'away' })
            .then(() => {
              mutate('/api/users');
              info(name === 'away' ? '자리 비움으로 표시했습니다.' : '온라인으로 표시했습니다.');
            })
            .catch(fail);
          return true;
        case 'topic':
          axios
            .patch(channelUrl, { topic: args || null })
            .then(() => info(args ? `#${channel} 주제: ${args}` : `#${channel} 주제를 지웠습니다.`))
            .catch(fail);
          return true;
        case 'mute':
        case 'unmute':
          (name === 'mute' ? axios.put(`${channelUrl}/mute`) : axios.delete(`${channelUrl}/mute`))
            .then(() => {
              mutate(`/api/workspaces/${workspace}/channels`);
              info(name === 'mute' ? `#${channel} 알림을 껐습니다.` : `#${channel} 알림을 켰습니다.`);
            })
            .catch(fail);
          return true;
        case 'shrug':
          sendMessage(`${args ? `${args} ` : ''}¯\\_(ツ)_/¯`);
          return true;
        default:
          return false;
      }
    },
    [workspace, me, channel, sendMessage],
  );
}
