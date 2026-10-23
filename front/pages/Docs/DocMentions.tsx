import { IChat, IDM } from '@typings/db';
import { messageToText } from '@utils/docLinks';
import fetcher from '@utils/fetcher';
import dayjs from 'dayjs';
import { MessagesSquare } from 'lucide-react';
import React, { FC, useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import useSWR from 'swr';
import { MentionMenu } from './styles';

interface Mentions {
  chats: IChat[];
  dms: IDM[];
}

// 문서 머리의 "대화" 단추: 이 문서 링크가 나온 채널 메시지·DM 목록 (문서 → 채팅)
const DocMentions: FC<{ workspace: string; docId: number; myId: number }> = ({ workspace, docId, myId }) => {
  const history = useHistory();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const { data } = useSWR<Mentions>(`/api/workspaces/${workspace}/search/doc-mentions/${docId}`, fetcher, {
    revalidateOnFocus: false,
  });
  const items = [
    ...(data?.chats || []).map((c) => ({
      key: `c${c.id}`,
      where: `#${c.Channel?.name}`,
      who: c.User?.nickname || c.botName || '앱',
      at: c.createdAt,
      text: messageToText(c.content),
      path: `/workspace/${workspace}/channel/${encodeURIComponent(c.Channel?.name || '')}?${
        c.ParentId ? `message=${c.ParentId}&reply=${c.id}` : `message=${c.id}`
      }`,
    })),
    ...(data?.dms || []).map((d) => {
      const other = d.SenderId === myId ? d.Receiver : d.Sender;
      return {
        key: `d${d.id}`,
        where: `${other.nickname} 님과의 DM`,
        who: d.Sender.nickname,
        at: d.createdAt,
        text: messageToText(d.content),
        path: `/workspace/${workspace}/dm/${other.id}?message=${d.id}`,
      };
    }),
  ].sort((a, b) => dayjs(b.at).valueOf() - dayjs(a.at).valueOf());

  useEffect(() => {
    if (!open) return undefined;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <span ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className={`btn${open ? ' on' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="이 문서가 언급된 대화"
      >
        <MessagesSquare size={14} style={{ verticalAlign: '-3px' }} /> 대화{items.length ? ` ${items.length}` : ''}
      </button>
      {open && (
        <MentionMenu role="menu" aria-label="이 문서가 언급된 대화">
          <strong>이 문서가 언급된 대화</strong>
          {items.length === 0 && (
            <p className="empty">
              아직 없어요. 공유 창의 "채널에 보내기"로 채널에 알리거나, 메시지에 이 문서 링크를 붙여 보세요.
            </p>
          )}
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                history.push(item.path);
              }}
            >
              <span className="meta">
                <b>{item.where}</b> · {item.who} · {dayjs(item.at).format('M/D HH:mm')}
              </span>
              <span className="text">{item.text}</span>
            </button>
          ))}
        </MentionMenu>
      )}
    </span>
  );
};

export default DocMentions;
