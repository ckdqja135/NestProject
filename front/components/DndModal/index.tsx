import Modal from '@components/Modal';
import { Actions, Field, FormError } from '@components/ModalForm/styles';
import { browserTimeZone, DAY_LABELS, DndSchedule, isQuietNow } from '@utils/dnd';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import React, { FC, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { DayPicker, TimeRow } from './styles';

interface Props {
  show: boolean;
  current: DndSchedule | null;
  onCloseModal: () => void;
  onSaved: (schedule: DndSchedule | null) => void;
}

const DEFAULT: DndSchedule = { on: true, start: '22:00', end: '08:00', days: [0, 1, 2, 3, 4, 5, 6], tz: 'UTC' };

// 방해 금지 시간: 정한 요일·시간에는 데스크톱·푸시 알림을 보내지 않는다 (모든 기기 공통)
const DndModal: FC<Props> = ({ show, current, onCloseModal, onSaved }) => {
  const [draft, setDraft] = useState<DndSchedule>(DEFAULT);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (show) {
      setDraft({ ...(current || DEFAULT), on: current ? current.on : true, tz: browserTimeZone() });
      setError('');
    }
  }, [show, current]);

  const toggleDay = (day: number) =>
    setDraft((d) => ({
      ...d,
      days: d.days.includes(day) ? d.days.filter((x) => x !== day) : [...d.days, day].sort(),
    }));

  const save = (schedule: DndSchedule | null) => {
    setSaving(true);
    setError('');
    axios
      .patch('/api/users/me/preferences', { dndSchedule: schedule })
      .then(() => {
        onSaved(schedule);
        toast.info(
          schedule?.on ? `방해 금지 시간을 ${schedule.start}~${schedule.end} 로 정했어요.` : '방해 금지 시간을 껐어요.',
          { position: 'bottom-center' },
        );
        onCloseModal();
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setSaving(false));
  };

  const overnight = draft.start > draft.end;
  const quiet = isQuietNow(draft);

  return (
    <Modal
      show={show}
      onCloseModal={onCloseModal}
      title="방해 금지 시간"
      description="이 시간에는 데스크톱·푸시 알림을 보내지 않아요. 메시지는 그대로 쌓이고, 끝나면 다시 알림이 와요."
    >
      {error && <FormError role="alert">{error}</FormError>}
      <Field>
        <label className="check-line">
          <input type="checkbox" checked={draft.on} onChange={(e) => setDraft({ ...draft, on: e.target.checked })} />
          방해 금지 시간 쓰기
        </label>
      </Field>
      <Field>
        <label>시간</label>
        <TimeRow>
          <input
            type="time"
            value={draft.start}
            onChange={(e) => e.target.value && setDraft({ ...draft, start: e.target.value })}
            aria-label="시작 시각"
            disabled={!draft.on}
          />
          <span>부터</span>
          <input
            type="time"
            value={draft.end}
            onChange={(e) => e.target.value && setDraft({ ...draft, end: e.target.value })}
            aria-label="끝 시각"
            disabled={!draft.on}
          />
          <span>까지{overnight ? ' (다음 날)' : ''}</span>
        </TimeRow>
      </Field>
      <Field>
        <label>요일</label>
        <DayPicker role="group" aria-label="요일">
          {DAY_LABELS.map((label, day) => (
            <button
              key={label}
              type="button"
              className={draft.days.includes(day) ? 'on' : undefined}
              aria-pressed={draft.days.includes(day)}
              disabled={!draft.on}
              onClick={() => toggleDay(day)}
            >
              {label}
            </button>
          ))}
        </DayPicker>
        <p className="hint">{draft.on && quiet ? '🌙 지금은 방해 금지 시간이에요.' : `시간대: ${draft.tz}`}</p>
      </Field>
      <Actions>
        {current && (
          <button type="button" onClick={() => save(null)} disabled={saving}>
            지우기
          </button>
        )}
        <button type="button" onClick={onCloseModal}>
          취소
        </button>
        <button
          type="button"
          className="primary"
          disabled={saving || (draft.on && (!draft.days.length || draft.start === draft.end))}
          onClick={() => save(draft)}
        >
          저장
        </button>
      </Actions>
    </Modal>
  );
};

export default DndModal;
