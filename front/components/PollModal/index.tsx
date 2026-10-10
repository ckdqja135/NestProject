import Modal from '@components/Modal';
import { Actions, Field, FormError, TextInput } from '@components/ModalForm/styles';
import { MAX_POLL_OPTIONS, Poll } from '@utils/poll';
import React, { FC, useEffect, useState } from 'react';

interface Props {
  show: boolean;
  onCloseModal: () => void;
  onCreate: (poll: Poll) => void;
}

// 투표 만들기: 질문과 선택지 2~10개
const PollModal: FC<Props> = ({ show, onCloseModal, onCreate }) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [error, setError] = useState('');

  useEffect(() => {
    if (show) {
      setQuestion('');
      setOptions(['', '']);
      setError('');
    }
  }, [show]);

  const filled = options.map((o) => o.trim()).filter(Boolean);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) {
      setError('질문을 입력해 주세요.');
      return;
    }
    if (filled.length < 2) {
      setError('선택지를 두 개 이상 입력해 주세요.');
      return;
    }
    if (new Set(filled).size !== filled.length) {
      setError('같은 선택지가 있습니다.');
      return;
    }
    onCreate({ q: question.trim(), o: filled });
    onCloseModal();
  };

  return (
    <Modal
      show={show}
      onCloseModal={onCloseModal}
      title="투표 만들기"
      description="선택지 번호 이모지로 투표합니다. 여러 개를 고를 수 있어요."
    >
      <form onSubmit={onSubmit}>
        <Field>
          <label htmlFor="poll-question">질문</label>
          <TextInput
            id="poll-question"
            value={question}
            maxLength={200}
            placeholder="점심 뭐 먹을까요?"
            onChange={(e) => setQuestion(e.target.value)}
          />
        </Field>
        <Field>
          <label>선택지</label>
          {options.map((option, index) => (
            <div key={index} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <TextInput
                value={option}
                maxLength={100}
                placeholder={`선택지 ${index + 1}`}
                aria-label={`선택지 ${index + 1}`}
                onChange={(e) => setOptions((prev) => prev.map((o, i) => (i === index ? e.target.value : o)))}
              />
              {options.length > 2 && (
                <button
                  type="button"
                  aria-label={`선택지 ${index + 1} 빼기`}
                  onClick={() => setOptions((prev) => prev.filter((_, i) => i !== index))}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    fontSize: 18,
                    cursor: 'pointer',
                  }}
                >
                  &times;
                </button>
              )}
            </div>
          ))}
          {options.length < MAX_POLL_OPTIONS && (
            <button
              type="button"
              onClick={() => setOptions((prev) => [...prev, ''])}
              style={{ border: 'none', background: 'transparent', color: '#1264a3', cursor: 'pointer', padding: 0 }}
            >
              ＋ 선택지 추가
            </button>
          )}
        </Field>
        {error && <FormError role="alert">{error}</FormError>}
        <Actions>
          <button type="button" onClick={onCloseModal}>
            취소
          </button>
          <button type="submit" className="primary">
            투표 올리기
          </button>
        </Actions>
      </form>
    </Modal>
  );
};

export default PollModal;
