import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { ChevronLeft, ChevronRight, MonitorPlay, PanelRight, RotateCcw, X } from 'lucide-react';
import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { H, Slide, W } from './slides/model';
import SlideView, { animCount } from './slides/SlideView';
import { Presenter } from './styles';

interface Props {
  slides: Slide[];
  start: number;
  workspace: string;
  emojis?: Record<string, string>;
  onClose: () => void;
}

const fade = keyframes`from { opacity: 0 } to { opacity: 1 }`;
const slideIn = keyframes`from { transform: translateX(100%) } to { transform: none }`;
const zoom = keyframes`from { opacity: 0; transform: scale(0.85) } to { opacity: 1; transform: none }`;

const Stage = styled.div`
  &.t-fade {
    animation: ${fade} 0.45s ease-out;
  }
  &.t-slide {
    animation: ${slideIn} 0.45s ease-out;
  }
  &.t-zoom {
    animation: ${zoom} 0.45s ease-out;
  }
`;

const Speaker = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 20px;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 20px 20px 70px;
  color: #eee;

  & .side {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
  }

  & .label {
    font-size: 12px;
    color: #aaa;
  }

  & .timer {
    font-size: 34px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  & .notes {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 12px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.07);
    font-size: 18px;
    line-height: 1.5;
    white-space: pre-wrap;
  }

  & .main {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
  }
`;

const fitScale = (speaker: boolean) =>
  speaker
    ? Math.min((window.innerWidth - 400) / W, (window.innerHeight - 110) / H)
    : Math.min((window.innerWidth * 0.96) / W, (window.innerHeight * 0.92) / H);

// 발표 모드: 전체 화면, ← → 로 넘기고 Esc 로 끝낸다.
// 애니메이션이 있는 요소는 누를 때마다 하나씩, 숨긴 쪽은 건너뛴다. P 로 발표자 보기 (메모·타이머·다음 쪽)
const SlidePresenter: FC<Props> = ({ slides: all, start, workspace, emojis, onClose }) => {
  const order = useMemo(() => {
    const list = all.map((s, i) => i).filter((i) => !all[i].hidden);
    return list.length ? list : [Math.min(start, all.length - 1)];
  }, [all, start]);
  const [pos, setPos] = useState(() =>
    Math.max(
      0,
      order.findIndex((i) => i >= start),
    ),
  );
  const [reveal, setReveal] = useState(0);
  const [speaker, setSpeaker] = useState(false);
  const [scale, setScale] = useState(() => fitScale(false));
  const [started] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());
  const [timerBase, setTimerBase] = useState(started);
  const ref = useRef<HTMLDivElement>(null);
  const slide = all[order[pos]];
  const steps = slide ? animCount(slide) : 0;
  const last = order.length - 1;

  const next = useCallback(() => {
    if (reveal < steps) {
      setReveal((r) => r + 1);
      return;
    }
    if (pos < last) {
      setPos((p) => p + 1);
      setReveal(0);
    }
  }, [reveal, steps, pos, last]);
  const prev = useCallback(() => {
    if (reveal > 0) {
      setReveal((r) => r - 1);
      return;
    }
    if (pos > 0) {
      const p = pos - 1;
      setPos(p);
      setReveal(animCount(all[order[p]]));
    }
  }, [reveal, pos, all, order]);

  useEffect(() => {
    setScale(fitScale(speaker));
  }, [speaker]);

  useEffect(() => {
    const el = ref.current;
    el?.requestFullscreen?.().catch(() => {
      // 전체 화면을 못 쓰면 창 안에서 발표한다
    });
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const onFullscreen = () => {
      if (!document.fullscreenElement) onClose();
    };
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('fullscreenchange', onFullscreen);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => undefined);
      }
    };
  }, [onClose]);

  useEffect(() => {
    const onResize = () => setScale(fitScale(speaker));
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n'].includes(e.key)) {
        e.preventDefault();
        next();
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) {
        e.preventDefault();
        prev();
      } else if (e.key === 'Home') {
        setPos(0);
        setReveal(0);
      } else if (e.key === 'End') {
        setPos(last);
        setReveal(0);
      } else if (e.key.toLowerCase() === 'p' || e.key.toLowerCase() === 's') {
        setSpeaker((v) => !v);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [next, prev, last, onClose, speaker]);

  const elapsed = Math.max(0, Math.floor((now - timerBase) / 1000));
  const clock = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  const nextSlide = pos < last ? all[order[pos + 1]] : null;
  const current = slide && (
    <Stage
      key={`${order[pos]}`}
      className={reveal === 0 && slide.transition && slide.transition !== 'none' ? `t-${slide.transition}` : undefined}
    >
      <SlideView slide={slide} scale={scale} workspace={workspace} emojis={emojis} reveal={reveal} />
    </Stage>
  );

  return (
    <Presenter ref={ref} role="dialog" aria-label="슬라이드 발표">
      {speaker ? (
        <Speaker>
          <div className="main stage" onClick={next}>
            {current}
          </div>
          <div className="side">
            <div>
              <div className="label">지난 시간</div>
              <div className="timer" aria-label="지난 시간">
                {clock}{' '}
                <button
                  type="button"
                  onClick={() => setTimerBase(Date.now())}
                  aria-label="타이머 다시 시작"
                  style={{ verticalAlign: 'middle' }}
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>
            <div>
              <div className="label">다음 쪽</div>
              {nextSlide ? (
                <SlideView slide={nextSlide} scale={300 / W} workspace={workspace} emojis={emojis} />
              ) : (
                <p className="label">마지막 쪽입니다.</p>
              )}
            </div>
            <div className="label">발표자 메모</div>
            <div className="notes" aria-label="발표자 메모">
              {slide?.notes || '메모가 없습니다.'}
            </div>
          </div>
        </Speaker>
      ) : (
        <div onClick={next} className="stage">
          {current}
        </div>
      )}
      <div className="controls">
        <button type="button" onClick={prev} disabled={pos === 0 && reveal === 0} aria-label="이전">
          <ChevronLeft size={18} />
        </button>
        <span className="page">
          {pos + 1} / {order.length}
        </span>
        <button type="button" onClick={next} disabled={pos === last && reveal >= steps} aria-label="다음">
          <ChevronRight size={18} />
        </button>
        <button
          type="button"
          onClick={() => setSpeaker((v) => !v)}
          aria-label="발표자 보기"
          aria-pressed={speaker}
          title="발표자 보기 (P)"
        >
          {speaker ? <MonitorPlay size={16} /> : <PanelRight size={16} />} {speaker ? '청중 화면' : '발표자 보기'}
        </button>
        <button type="button" onClick={onClose} aria-label="발표 끝내기">
          <X size={16} /> 끝내기
        </button>
      </div>
    </Presenter>
  );
};

export default SlidePresenter;
