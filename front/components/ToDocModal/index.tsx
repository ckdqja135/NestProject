import Modal from '@components/Modal';
import { Actions, Field, FormError, TextInput } from '@components/ModalForm/styles';
import useMyRole from '@hooks/useMyRole';
import { IChannel, IChat, IDM } from '@typings/db';
import { docRoute, docUrl, messageToText, titleFrom } from '@utils/docLinks';
import fetcher from '@utils/fetcher';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import dayjs from 'dayjs';
import React, { FC, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { toast } from 'react-toastify';
import useSWR from 'swr';
import { Checks } from './styles';

// 메시지 하나, 또는 스레드 전체를 문서로 옮긴다 (채팅 → 작업물).
// 만든 뒤 원래 대화에 문서 링크를 남기고, 비공개 문서면 대화에 있던 사람에게 보기 권한을 준다.

export type ToDocSource =
  | { kind: 'message'; chat: IChat | IDM; channel?: string }
  | { kind: 'thread'; parent: IChat; replies: IChat[]; channel: string };

interface Props {
  show: boolean;
  workspace: string;
  myId: number;
  source: ToDocSource;
  onClose: () => void;
}

const isDM = (chat: IChat | IDM): chat is IDM => 'Sender' in chat;
const senderName = (chat: IChat | IDM) =>
  isDM(chat) ? chat.Sender.nickname : chat.User?.nickname || chat.botName || '앱';
const when = (iso: string | Date) => dayjs(iso).format('YYYY-MM-DD HH:mm');

const ToDocModal: FC<Props> = ({ show, workspace, myId, source, onClose }) => {
  const history = useHistory();
  const isGuest = useMyRole(workspace) === 'guest';
  const { data: channels } = useSWR<IChannel[]>(show ? `/api/workspaces/${workspace}/channels` : null, fetcher);
  const first = source.kind === 'thread' ? source.parent : source.chat;
  const dm = isDM(first) ? first : null;
  const channelName = source.kind === 'thread' ? source.channel : dm ? null : source.channel || null;
  const channel = channelName ? channels?.find((c) => c.name === channelName) : undefined;
  const dmOther = dm ? (dm.SenderId === myId ? dm.Receiver : dm.Sender) : null;
  const where = channelName ? `#${channelName}` : dmOther ? `${dmOther.nickname} 님과의 DM` : '대화';

  // 창은 열 때마다 새로 그리므로 처음 값으로 바로 채운다 (빈 제목이 잠깐 보이지 않게)
  const [title, setTitle] = useState(() =>
    titleFrom(messageToText(first.content), `${where} 대화 정리 (${dayjs().format('YYYY-MM-DD')})`),
  );
  // 고르기 전에는 공개 채널 대화면 워크스페이스 공개, 그 밖에는 비공개 (게스트는 늘 비공개)
  const [picked, setPicked] = useState<'private' | 'workspace' | null>(null);
  const visibility = picked ?? (!isGuest && channel && !channel.private ? 'workspace' : 'private');
  const setVisibility = setPicked;
  const [leaveLink, setLeaveLink] = useState(true);
  const [grant, setGrant] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const permalink = useMemo(() => {
    const origin = window.location.origin;
    if (dm && dmOther) return `${origin}/workspace/${workspace}/dm/${dmOther.id}?message=${dm.id}`;
    const chat = first as IChat;
    const query = chat.ParentId ? `message=${chat.ParentId}&reply=${chat.id}` : `message=${chat.id}`;
    return `${origin}/workspace/${workspace}/channel/${encodeURIComponent(channelName || '')}?${query}`;
  }, [dm, dmOther, first, workspace, channelName]);

  const content = useMemo(() => {
    if (source.kind === 'thread') {
      const all = [source.parent, ...source.replies];
      const body = all.map((c) => `**${senderName(c)}** · ${when(c.createdAt)}\n\n${messageToText(c.content)}`);
      return [
        `> 💬 ${where} 스레드에서 정리했어요 (메시지 ${all.length}개). [원래 스레드 보기](${permalink})`,
        ...body,
      ].join('\n\n');
    }
    return [
      messageToText(first.content),
      '---',
      `*${where}에서 ${senderName(first)} 님이 ${when(
        first.createdAt,
      )}에 보낸 메시지로 만들었어요.* [원래 메시지 보기](${permalink})`,
    ].join('\n\n');
  }, [source, first, where, permalink]);

  const count = source.kind === 'thread' ? source.replies.length + 1 : 1;
  const canGrant = visibility === 'private' && (!!channelName || !!dmOther);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || pending) return;
    setPending(true);
    setError('');
    try {
      const { data: doc } = await axios.post<{ id: number }>(`/api/workspaces/${workspace}/docs`, {
        type: 'doc',
        title: title.trim(),
        content,
        visibility,
      });
      const link = docUrl(workspace, doc.id);
      // 원래 대화에 문서 링크 남기기 (채널이면 그 메시지의 스레드에)
      if (leaveLink) {
        const note = `📄 문서로 정리했어요: ${link}`;
        if (channelName) {
          const rootId = source.kind === 'thread' ? source.parent.id : (first as IChat).ParentId || first.id;
          await axios.post(
            `/api/workspaces/${workspace}/channels/${encodeURIComponent(channelName)}/chats/${rootId}/replies`,
            { content: note },
          );
        } else if (dmOther) {
          await axios.post(`/api/workspaces/${workspace}/dms/${dmOther.id}/chats`, { content: note });
        }
      }
      if (canGrant && grant) {
        if (channelName) {
          await axios.put(`/api/workspaces/${workspace}/docs/${doc.id}/channel-share`, { channel: channelName });
        } else if (dmOther) {
          await axios.put(`/api/workspaces/${workspace}/docs/${doc.id}/shares`, { userId: dmOther.id, role: 'view' });
        }
      }
      toast.success('문서로 만들었어요.', { position: 'bottom-center' });
      onClose();
      history.push(docRoute(workspace, doc.id));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      show={show}
      onCloseModal={onClose}
      title={source.kind === 'thread' ? '스레드를 문서로 정리' : '메시지로 문서 만들기'}
      description={`${where}의 메시지 ${count}개를 새 문서로 옮겨요. 원래 메시지 링크도 문서에 남겨요.`}
    >
      <form onSubmit={submit}>
        {error && <FormError role="alert">{error}</FormError>}
        <Field>
          <label htmlFor="to-doc-title">문서 제목</label>
          <TextInput
            id="to-doc-title"
            value={title}
            maxLength={200}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field>
          <label>공개 범위</label>
          <Checks>
            <label>
              <input
                type="radio"
                name="to-doc-visibility"
                checked={visibility === 'private'}
                onChange={() => setVisibility('private')}
              />
              나와 공유한 사람만
            </label>
            {!isGuest && (
              <label>
                <input
                  type="radio"
                  name="to-doc-visibility"
                  checked={visibility === 'workspace'}
                  onChange={() => setVisibility('workspace')}
                />
                워크스페이스 모두
              </label>
            )}
          </Checks>
        </Field>
        <Field>
          <Checks>
            {(channelName || dmOther) && (
              <label>
                <input type="checkbox" checked={leaveLink} onChange={(e) => setLeaveLink(e.target.checked)} />
                {channelName ? '그 메시지의 스레드에 문서 링크 남기기' : 'DM 에 문서 링크 남기기'}
              </label>
            )}
            {canGrant && (
              <label>
                <input type="checkbox" checked={grant} onChange={(e) => setGrant(e.target.checked)} />
                {channelName
                  ? `#${channelName} 사람들에게 보기 권한 주기`
                  : `${dmOther?.nickname} 님에게 보기 권한 주기`}
              </label>
            )}
          </Checks>
        </Field>
        <Actions>
          <button type="button" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="primary" disabled={!title.trim() || pending}>
            {pending ? '만드는 중...' : '문서 만들기'}
          </button>
        </Actions>
      </form>
    </Modal>
  );
};

export default ToDocModal;
