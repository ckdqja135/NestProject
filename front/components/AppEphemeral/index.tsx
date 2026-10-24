import useCustomEmojis from '@hooks/useCustomEmojis';
import { AppReply } from '@hooks/useAppEphemeral';
import { renderMarkdown } from '@utils/markdown';
import { Bot, Lock, X } from 'lucide-react';
import React, { FC } from 'react';
import { List } from './styles';

// 입력창 위: 앱 명령의 "나에게만 보이는" 답
const AppEphemeral: FC<{ workspace: string; items: AppReply[]; onDismiss: (id: number) => void }> = ({
  workspace,
  items,
  onDismiss,
}) => {
  const { map: emojis } = useCustomEmojis(workspace, false);
  if (!items.length) return null;
  return (
    <List aria-label="나에게만 보이는 앱 답">
      {items.map((item) => (
        <li key={item.id} className={item.error ? 'error' : undefined}>
          <span className="avatar" aria-hidden="true">
            <Bot size={16} />
          </span>
          <div className="body">
            <header>
              <b>{item.appName}</b>
              <span className="pill">
                <Lock size={10} /> 나에게만 보임
              </span>
              <button type="button" onClick={() => onDismiss(item.id)} aria-label="닫기">
                <X size={14} />
              </button>
            </header>
            <div className="text">{renderMarkdown(item.text, workspace, emojis)}</div>
          </div>
        </li>
      ))}
    </List>
  );
};

export default AppEphemeral;
