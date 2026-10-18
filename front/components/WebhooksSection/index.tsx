import { Bot } from 'lucide-react';
import styled from '@emotion/styled';
import { Field, TextInput } from '@components/ModalForm/styles';
import fetcher from '@utils/fetcher';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import React, { FC, useState } from 'react';
import { toast } from 'react-toastify';
import useSWR from 'swr';

const List = styled.ul`
  list-style: none;
  margin: 0 0 12px;
  padding: 0;

  & > li {
    padding: 8px 0;
    border-bottom: 1px solid var(--border);
  }

  & .row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  & .name {
    flex: 1;
    font-weight: 700;
  }

  & code {
    display: block;
    margin-top: 4px;
    padding: 4px 6px;
    border-radius: 4px;
    background: var(--bg-subtle);
    font-size: 12px;
    word-break: break-all;
  }

  & button {
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    background: var(--bg);
    color: var(--text);
    padding: 2px 8px;
    font-size: 12px;
    cursor: pointer;

    &.danger {
      border-color: #e01e5a;
      color: #e01e5a;
    }
  }
`;

interface Webhook {
  id: number;
  name: string;
  token: string;
  CreatorId: number | null;
}

interface Props {
  workspace: string;
  channel: string;
  disabled?: boolean;
}

// 수신 웹훅: 외부 서비스(GitHub, 배포 알림 등)가 이 채널에 메시지를 보내는 주소
const WebhooksSection: FC<Props> = ({ workspace, channel, disabled }) => {
  const base = `/api/workspaces/${workspace}/channels/${encodeURIComponent(channel)}/webhooks`;
  const { data: webhooks, mutate } = useSWR<Webhook[]>(base, fetcher);
  const [name, setName] = useState('');
  const hookUrl = (token: string) => `${window.location.origin}/api/hooks/${token}`;

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      return;
    }
    axios
      .post(base, { name: name.trim() })
      .then(() => {
        setName('');
        mutate();
        toast.success('웹훅을 만들었습니다. 주소를 외부 서비스에 넣으세요.', { position: 'bottom-center' });
      })
      .catch((error) => toast.error(getErrorMessage(error), { position: 'bottom-center' }));
  };

  const onDelete = (webhook: Webhook) =>
    axios
      .delete(`${base}/${webhook.id}`)
      .then(() => mutate())
      .catch((error) => toast.error(getErrorMessage(error), { position: 'bottom-center' }));

  const onCopy = (webhook: Webhook) =>
    navigator.clipboard
      ?.writeText(hookUrl(webhook.token))
      .then(() => toast.info('웹훅 주소를 복사했습니다.', { position: 'bottom-center' }))
      .catch(() => toast.error('복사하지 못했습니다.', { position: 'bottom-center' }));

  return (
    <div>
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>수신 웹훅</h3>
      <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-muted)' }}>
        외부 서비스가 아래 주소로 <code>{'{"text": "내용"}'}</code> 을 POST 하면 이 채널에 메시지가 올라옵니다. 주소를
        아는 누구나 보낼 수 있으니 공개하지 마세요.
      </p>
      <List>
        {webhooks?.map((webhook) => (
          <li key={webhook.id}>
            <div className="row">
              <span className="name">
                <Bot size={14} style={{ verticalAlign: '-2px' }} /> {webhook.name}
              </span>
              <button type="button" onClick={() => onCopy(webhook)}>
                주소 복사
              </button>
              <button type="button" className="danger" onClick={() => onDelete(webhook)}>
                삭제
              </button>
            </div>
            <code>{hookUrl(webhook.token)}</code>
          </li>
        ))}
      </List>
      {!disabled && (
        <form onSubmit={onCreate} style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          <Field style={{ flex: 1, marginBottom: 0 }}>
            <label htmlFor="webhook-name">새 웹훅 이름</label>
            <TextInput
              id="webhook-name"
              value={name}
              maxLength={40}
              placeholder="GitHub"
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <button
            type="submit"
            disabled={!name.trim()}
            style={{
              height: 40,
              border: 'none',
              borderRadius: 6,
              background: '#007a5a',
              color: 'white',
              padding: '0 14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            만들기
          </button>
        </form>
      )}
    </div>
  );
};

export default WebhooksSection;
