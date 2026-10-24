import { AppButton } from '@utils/appMessage';
import getErrorMessage from '@utils/getErrorMessage';
import { renderMarkdown } from '@utils/markdown';
import axios from 'axios';
import React, { FC, useState } from 'react';
import { toast } from 'react-toastify';
import { Buttons } from './styles';

interface Props {
  workspace: string;
  // 채널 메시지면 chatId, DM 이면 dmId
  message: { chatId: number } | { dmId: number };
  text: string;
  buttons: AppButton[];
  emojis?: Record<string, string>;
}

// 앱이 보낸 버튼 달린 메시지: 누르면 앱에 전달되고, 앱의 답은 메시지가 바뀌거나 나에게만 보이는 칸으로 온다
const AppMessage: FC<Props> = ({ workspace, message, text, buttons, emojis }) => {
  const [pending, setPending] = useState<string | null>(null);
  const press = (button: AppButton) => {
    setPending(button.id);
    axios
      .post(`/api/workspaces/${workspace}/apps/actions`, { ...message, actionId: button.id })
      .catch((err) => toast.error(getErrorMessage(err), { position: 'bottom-center' }))
      .finally(() => setPending(null));
  };
  return (
    <div className="message-body" data-app-message>
      {renderMarkdown(text, workspace, emojis)}
      <Buttons role="group" aria-label="앱 버튼">
        {buttons.map((button) => (
          <button
            key={button.id}
            type="button"
            className={button.style}
            disabled={pending !== null}
            onClick={() => press(button)}
          >
            {pending === button.id ? '보내는 중…' : button.label}
          </button>
        ))}
      </Buttons>
    </div>
  );
};

export default AppMessage;
