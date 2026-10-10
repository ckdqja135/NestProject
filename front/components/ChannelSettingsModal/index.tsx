import Modal from '@components/Modal';
import { Actions, Field, FormError, TextInput } from '@components/ModalForm/styles';
import { Section } from '@components/ProfileModal/styles';
import { IChannel } from '@typings/db';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import React, { FC, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { DangerZone } from './styles';

interface Props {
  show: boolean;
  workspace: string;
  channel: IChannel;
  canManage: boolean; // 채널을 만든 사람 또는 워크스페이스 소유자
  onCloseModal: () => void;
  onRenamed: (newName: string) => void;
  onDeleted: () => void;
}

// 채널 설정: 주제(멤버 누구나), 이름 변경·보관·삭제(만든 사람/워크스페이스 소유자)
const ChannelSettingsModal: FC<Props> = ({
  show,
  workspace,
  channel,
  canManage,
  onCloseModal,
  onRenamed,
  onDeleted,
}) => {
  const [topic, setTopic] = useState(channel.topic || '');
  const [name, setName] = useState(channel.name);
  const [confirmName, setConfirmName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const base = `/api/workspaces/${workspace}/channels/${encodeURIComponent(channel.name)}`;
  const isGeneral = channel.name === '일반';
  const manageable = canManage && !isGeneral;

  useEffect(() => {
    if (show) {
      setTopic(channel.topic || '');
      setName(channel.name);
      setConfirmName('');
      setError('');
    }
  }, [show, channel.topic, channel.name]);

  const run = useCallback(<T,>(request: Promise<T>, message: string, after?: (result: T) => void) => {
    setBusy(true);
    setError('');
    request
      .then((result) => {
        toast.success(message, { position: 'bottom-center' });
        after?.(result);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setBusy(false));
  }, []);

  const onSaveTopic = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      run(axios.patch(base, { topic: topic.trim() || null }), '채널 주제를 바꿨습니다.');
    },
    [base, topic, run],
  );

  const trimmedName = name.trim();
  const onRename = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!trimmedName || trimmedName === channel.name) {
        return;
      }
      run(axios.patch(base, { name: trimmedName }), `채널 이름을 #${trimmedName}(으)로 바꿨습니다.`, () => {
        onCloseModal();
        onRenamed(trimmedName);
      });
    },
    [base, trimmedName, channel.name, run, onCloseModal, onRenamed],
  );

  const onToggleArchive = useCallback(() => {
    const archived = !channel.archived;
    run(
      archived ? axios.put(`${base}/archive`) : axios.delete(`${base}/archive`),
      archived
        ? `#${channel.name} 채널을 보관했습니다. 이제 읽기만 할 수 있어요.`
        : `#${channel.name} 채널 보관을 해제했습니다.`,
      onCloseModal,
    );
  }, [base, channel.archived, channel.name, run, onCloseModal]);

  const onDelete = useCallback(() => {
    run(axios.delete(base), `#${channel.name} 채널을 삭제했습니다.`, () => {
      onCloseModal();
      onDeleted();
    });
  }, [base, channel.name, run, onCloseModal, onDeleted]);

  return (
    <Modal show={show} onCloseModal={onCloseModal} title={`#${channel.name} 채널 설정`}>
      {error && <FormError role="alert">{error}</FormError>}
      <Section>
        <form onSubmit={onSaveTopic}>
          <Field>
            <label htmlFor="channel-topic">주제</label>
            <TextInput
              id="channel-topic"
              value={topic}
              maxLength={250}
              placeholder="이 채널에서 나누는 이야기"
              onChange={(e) => setTopic(e.target.value)}
              disabled={channel.archived}
            />
            <p className="hint">채널 이름 옆에 보입니다. 채널 멤버 누구나 바꿀 수 있어요.</p>
          </Field>
          <Actions style={{ marginTop: 0 }}>
            <button
              type="submit"
              className="primary"
              disabled={busy || channel.archived || topic.trim() === (channel.topic || '')}
            >
              주제 저장
            </button>
          </Actions>
        </form>
      </Section>
      {manageable && (
        <Section>
          <form onSubmit={onRename}>
            <Field>
              <label htmlFor="channel-name">채널 이름</label>
              <TextInput
                id="channel-name"
                value={name}
                maxLength={30}
                onChange={(e) => setName(e.target.value)}
                disabled={channel.archived}
              />
              <p className="hint">이름을 바꾸면 채널 주소도 바뀝니다.</p>
            </Field>
            <Actions style={{ marginTop: 0 }}>
              <button
                type="submit"
                className="primary"
                disabled={busy || channel.archived || !trimmedName || trimmedName === channel.name}
              >
                이름 바꾸기
              </button>
            </Actions>
          </form>
        </Section>
      )}
      {manageable && (
        <Section>
          <DangerZone>
            <div className="row">
              <div>
                <strong>{channel.archived ? '보관 해제' : '채널 보관'}</strong>
                <p>
                  {channel.archived
                    ? '다시 메시지를 주고받을 수 있게 됩니다.'
                    : '메시지는 남아 있고 읽기만 할 수 있습니다. 언제든 보관을 해제할 수 있어요.'}
                </p>
              </div>
              <button type="button" disabled={busy} onClick={onToggleArchive}>
                {channel.archived ? '보관 해제' : '보관하기'}
              </button>
            </div>
            <div className="row">
              <div>
                <strong>채널 삭제</strong>
                <p>
                  모든 메시지가 영구히 삭제되고 되돌릴 수 없습니다. 확인을 위해 채널 이름 <b>{channel.name}</b> 을(를)
                  입력하세요.
                </p>
                <TextInput
                  aria-label="삭제 확인용 채널 이름"
                  value={confirmName}
                  placeholder={channel.name}
                  onChange={(e) => setConfirmName(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="danger"
                disabled={busy || confirmName !== channel.name}
                onClick={onDelete}
              >
                삭제
              </button>
            </div>
          </DangerZone>
        </Section>
      )}
      {!canManage && !isGeneral && (
        <p style={{ color: '#616061', fontSize: 13 }}>
          채널 이름 변경·보관·삭제는 채널을 만든 사람과 워크스페이스 소유자만 할 수 있습니다.
        </p>
      )}
    </Modal>
  );
};

export default ChannelSettingsModal;
