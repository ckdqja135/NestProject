import Modal from '@components/Modal';
import { Actions, FormError } from '@components/ModalForm/styles';
import { IChannel, IUser } from '@typings/db';
import { avatarUrl } from '@utils/avatar';
import fetcher from '@utils/fetcher';
import getErrorMessage from '@utils/getErrorMessage';
import { previewText } from '@utils/notify';
import axios from 'axios';
import { Hash, Lock, Search } from 'lucide-react';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import useSWR from 'swr';
import { Picker } from './styles';

interface Props {
  show: boolean;
  workspace: string;
  source: { source: 'chat' | 'dm'; id: number; content: string; author: string };
  onClose: () => void;
}

// label 은 조사까지 붙인 받는 곳 ('#일반에', '동료 님에게', '나에게')
type Target = { to: 'channel'; target: string; label: string } | { to: 'dm'; target: number; label: string };

// 메시지 전달: 보낼 채널이나 사람을 고르고, 덧붙일 말을 쓴다
const ForwardModal: FC<Props> = ({ show, workspace, source, onClose }) => {
  const { data: me } = useSWR<IUser>('/api/users', fetcher);
  const { data: channels } = useSWR<IChannel[]>(show ? `/api/workspaces/${workspace}/channels` : null, fetcher);
  const { data: members } = useSWR<IUser[]>(show ? `/api/workspaces/${workspace}/members` : null, fetcher);
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<Target | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (show) {
      setQuery('');
      setTarget(null);
      setComment('');
      setError('');
    }
  }, [show]);

  const keyword = query.trim().toLowerCase();
  const channelList = useMemo(
    () => (channels || []).filter((c) => !c.archived && (!keyword || c.name.toLowerCase().includes(keyword))),
    [channels, keyword],
  );
  const peopleList = useMemo(
    () =>
      (members || []).filter(
        (m) =>
          !m.bot && (!keyword || m.nickname.toLowerCase().includes(keyword) || m.email.toLowerCase().includes(keyword)),
      ),
    [members, keyword],
  );

  const send = () => {
    if (!target) {
      setError('보낼 곳을 골라 주세요.');
      return;
    }
    setSending(true);
    setError('');
    axios
      .post(`/api/workspaces/${workspace}/forward`, {
        source: source.source,
        id: source.id,
        to: target.to,
        target: target.target,
        comment,
      })
      .then(() => {
        toast.success(`${target.label} 전달했습니다.`, { position: 'bottom-center' });
        onClose();
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setSending(false));
  };

  const isSelected = (t: Target) => target?.to === t.to && target.target === t.target;

  return (
    <Modal show={show} onCloseModal={onClose} title="메시지 전달">
      <Picker>
        <blockquote className="original">
          <b>{source.author}</b>
          <span>{previewText(source.content)}</span>
        </blockquote>
        <div className="search">
          <Search size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="채널이나 사람 찾기"
            aria-label="보낼 곳 찾기"
          />
        </div>
        <div className="list" role="listbox" aria-label="보낼 곳">
          {channelList.length > 0 && <div className="group">채널</div>}
          {channelList.map((c) => {
            const t: Target = { to: 'channel', target: c.name, label: `#${c.name}에` };
            return (
              <button
                key={`c${c.id}`}
                type="button"
                role="option"
                aria-selected={isSelected(t)}
                className={isSelected(t) ? 'on' : undefined}
                onClick={() => setTarget(t)}
              >
                {c.private ? <Lock size={15} /> : <Hash size={15} />}
                <span>{c.name}</span>
              </button>
            );
          })}
          {peopleList.length > 0 && <div className="group">사람</div>}
          {peopleList.map((m) => {
            const label = m.id === me?.id ? '나에게' : `${m.nickname} 님에게`;
            const t: Target = { to: 'dm', target: m.id, label };
            return (
              <button
                key={`u${m.id}`}
                type="button"
                role="option"
                aria-selected={isSelected(t)}
                className={isSelected(t) ? 'on' : undefined}
                onClick={() => setTarget(t)}
              >
                <img src={avatarUrl(m, 40)} alt="" />
                <span>
                  {m.nickname}
                  {m.id === me?.id && <small> (나)</small>}
                </span>
              </button>
            );
          })}
          {!channelList.length && !peopleList.length && <p className="empty">찾는 채널이나 사람이 없습니다.</p>}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="덧붙일 말 (선택)"
          aria-label="덧붙일 말"
          rows={2}
          maxLength={4000}
        />
      </Picker>
      {error && <FormError role="alert">{error}</FormError>}
      <Actions>
        <button type="button" onClick={onClose}>
          취소
        </button>
        <button type="button" className="primary" onClick={send} disabled={!target || sending}>
          {sending ? '보내는 중...' : target ? `${target.label} 전달` : '전달'}
        </button>
      </Actions>
    </Modal>
  );
};

export default ForwardModal;
