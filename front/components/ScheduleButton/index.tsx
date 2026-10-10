import { AttachButton } from '@components/ChatBox/styles';
import styled from '@emotion/styled';
import { timePresets } from '@utils/timePresets';
import dayjs from 'dayjs';
import React, { FC, useEffect, useRef, useState } from 'react';

const Wrapper = styled.div`
  position: relative;
  display: inline-block;
`;

const Menu = styled.div`
  position: absolute;
  bottom: 32px;
  left: 0;
  z-index: 5;
  min-width: 260px;
  padding: 4px 0 8px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);

  & > .title {
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 700;
    color: var(--text-muted);
  }

  & > button {
    display: block;
    width: 100%;
    padding: 6px 12px;
    border: none;
    background: transparent;
    color: var(--text);
    font-size: 14px;
    text-align: left;
    cursor: pointer;

    &:hover {
      background: #1264a3;
      color: white;
    }
  }

  & > .custom {
    display: flex;
    gap: 6px;
    padding: 6px 12px 0;

    & input {
      flex: 1;
      min-width: 0;
      height: 30px;
      border: 1px solid var(--border-strong);
      border-radius: 4px;
      background: var(--bg);
      color: var(--text);
      padding: 0 6px;
    }

    & button {
      border: none;
      border-radius: 4px;
      background: #007a5a;
      color: white;
      padding: 0 10px;
      cursor: pointer;

      &:disabled {
        opacity: 0.5;
        cursor: default;
      }
    }
  }
`;

interface Props {
  disabled: boolean; // 입력한 내용이 없으면 예약할 것도 없다
  onSchedule: (date: Date) => void;
}

// 입력한 메시지를 정한 시각에 보내기
const ScheduleButton: FC<Props> = ({ disabled, onSchedule }) => {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    setCustom(dayjs().add(1, 'hour').minute(0).format('YYYY-MM-DDTHH:mm'));
    const onMouseDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const pick = (date: Date) => {
    setOpen(false);
    onSchedule(date);
  };
  const customDate = custom ? new Date(custom) : null;
  const customValid = !!customDate && customDate.getTime() > Date.now() + 10_000;

  return (
    <Wrapper ref={wrapperRef}>
      <AttachButton
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={disabled ? '보낼 내용을 먼저 입력하세요' : '정한 시각에 보내기'}
      >
        🕒 예약
      </AttachButton>
      {open && (
        <Menu role="menu" aria-label="보낼 시각">
          <div className="title">언제 보낼까요?</div>
          {timePresets().map((preset) => (
            <button key={preset.label} type="button" role="menuitem" onClick={() => pick(preset.date)}>
              {preset.label}
            </button>
          ))}
          <div className="custom">
            <input
              type="datetime-local"
              value={custom}
              min={dayjs().format('YYYY-MM-DDTHH:mm')}
              onChange={(e) => setCustom(e.target.value)}
              aria-label="직접 고르기"
            />
            <button type="button" disabled={!customValid} onClick={() => customDate && pick(customDate)}>
              예약
            </button>
          </div>
        </Menu>
      )}
    </Wrapper>
  );
};

export default ScheduleButton;
