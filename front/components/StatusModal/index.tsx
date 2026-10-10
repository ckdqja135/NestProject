import Modal from '@components/Modal';
import { Actions, Field, FormError, TextInput } from '@components/ModalForm/styles';
import { IUser } from '@typings/db';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import React, { FC, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { EmojiChoices, Presets, StatusInput } from './styles';

const EMOJIS = ['💬', '🗓️', '🚌', '🍚', '🤒', '🌴', '🏠', '🎧', '🔕', '✅'];
const PRESETS: [string, string][] = [
  ['🗓️', '회의 중'],
  ['🚌', '이동 중'],
  ['🍚', '식사 중'],
  ['🤒', '아파서 쉬는 중'],
  ['🌴', '휴가 중'],
  ['🏠', '재택 근무 중'],
];
const DEFAULT_EMOJI = '💬';

interface Props {
  show: boolean;
  me: IUser;
  onCloseModal: () => void;
  onUpdated: () => void;
}

// 상태 메시지 설정 (이름 옆에 이모지로 보이고, 마우스를 올리면 문구가 보인다)
const StatusModal: FC<Props> = ({ show, me, onCloseModal, onUpdated }) => {
  const [emoji, setEmoji] = useState(me.statusEmoji || DEFAULT_EMOJI);
  const [text, setText] = useState(me.statusText || '');
  const [showEmojis, setShowEmojis] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (show) {
      setEmoji(me.statusEmoji || DEFAULT_EMOJI);
      setText(me.statusText || '');
      setShowEmojis(false);
      setError('');
    }
  }, [show, me.statusEmoji, me.statusText]);

  const save = useCallback(
    (statusEmoji: string | null, statusText: string | null, message: string) => {
      setSaving(true);
      setError('');
      axios
        .patch('/api/users/me', { statusEmoji, statusText })
        .then(() => {
          toast.success(message, { position: 'bottom-center' });
          onUpdated();
          onCloseModal();
        })
        .catch((err) => setError(getErrorMessage(err)))
        .finally(() => setSaving(false));
    },
    [onUpdated, onCloseModal],
  );

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = text.trim();
      if (!trimmed) {
        setError('상태 문구를 입력해 주세요.');
        return;
      }
      save(emoji, trimmed, '상태를 설정했습니다.');
    },
    [emoji, text, save],
  );

  const hasStatus = !!(me.statusEmoji || me.statusText);

  return (
    <Modal show={show} onCloseModal={onCloseModal} title="상태 설정" description="이름 옆에 이모지로 표시됩니다.">
      <form onSubmit={onSubmit}>
        <Field>
          <label htmlFor="status-text">상태</label>
          <StatusInput>
            <button
              type="button"
              aria-label="이모지 고르기"
              aria-expanded={showEmojis}
              onClick={() => setShowEmojis((v) => !v)}
            >
              {emoji}
            </button>
            <TextInput
              id="status-text"
              value={text}
              maxLength={100}
              placeholder="지금 상태는?"
              onChange={(e) => setText(e.target.value)}
            />
          </StatusInput>
          {showEmojis && (
            <EmojiChoices role="radiogroup" aria-label="상태 이모지">
              {EMOJIS.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="radio"
                  aria-checked={emoji === item}
                  className={emoji === item ? 'selected' : undefined}
                  onClick={() => {
                    setEmoji(item);
                    setShowEmojis(false);
                  }}
                >
                  {item}
                </button>
              ))}
            </EmojiChoices>
          )}
        </Field>
        <Field>
          <label>추천</label>
          <Presets>
            {PRESETS.map(([presetEmoji, presetText]) => (
              <li key={presetText}>
                <button
                  type="button"
                  onClick={() => {
                    setEmoji(presetEmoji);
                    setText(presetText);
                  }}
                >
                  <span>{presetEmoji}</span>
                  <span>{presetText}</span>
                </button>
              </li>
            ))}
          </Presets>
        </Field>
        {error && <FormError role="alert">{error}</FormError>}
        <Actions>
          {hasStatus && (
            <button type="button" disabled={saving} onClick={() => save(null, null, '상태를 지웠습니다.')}>
              상태 지우기
            </button>
          )}
          <button type="submit" className="primary" disabled={saving || !text.trim()}>
            저장
          </button>
        </Actions>
      </form>
    </Modal>
  );
};

export default StatusModal;
