import { ForwardedMessage } from '@utils/forward';
import { parseGifContent } from '@utils/gif';
import { renderMarkdown } from '@utils/markdown';
import dayjs from 'dayjs';
import { CornerUpRight } from 'lucide-react';
import React, { FC } from 'react';
import { Link } from 'react-router-dom';
import { Card } from './styles';

// 전달된 메시지 속 원본 (전달한 순간의 모습)
const ForwardedCard: FC<{ forwarded: ForwardedMessage; workspace: string; emojis?: Record<string, string> }> = ({
  forwarded,
  workspace,
  emojis,
}) => {
  const { m } = forwarded;
  const gif = parseGifContent(m.t);
  const when = dayjs(m.at);
  return (
    <Card className="forwarded">
      <div className="head">
        <CornerUpRight size={13} />
        <span>전달된 메시지</span>
      </div>
      <div className="from">
        <b>{m.a}</b>
        <span>
          {m.ch ? `#${m.ch}` : 'DM'} ·{' '}
          {when.isSame(dayjs(), 'year') ? when.format('M월 D일 HH:mm') : when.format('YYYY년 M월 D일')}
        </span>
      </div>
      <div className="body">
        {gif ? <img src={gif} alt="GIF" className="gif" /> : renderMarkdown(m.t, workspace, emojis)}
      </div>
      {m.l && m.l.startsWith(`/workspace/${workspace}/`) && (
        <Link to={m.l} className="origin">
          원본 보기
        </Link>
      )}
    </Card>
  );
};

export default ForwardedCard;
