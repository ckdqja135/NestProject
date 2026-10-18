import React, { FC, ReactNode, useEffect, useRef, useState } from 'react';
import { DocBody, Presenter, SlideFrame } from './styles';

interface Props {
  slides: ReactNode[][];
  start: number;
  onClose: () => void;
}

// 발표 모드: 전체 화면, ← → 로 넘기고 Esc 로 끝낸다
const SlidePresenter: FC<Props> = ({ slides, start, onClose }) => {
  const [index, setIndex] = useState(start);
  const ref = useRef<HTMLDivElement>(null);
  const last = slides.length - 1;

  useEffect(() => {
    const el = ref.current;
    el?.requestFullscreen?.().catch(() => {
      // 전체 화면을 못 쓰면 창 안에서 발표한다
    });
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, last));
      } else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) {
        e.preventDefault();
        setIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Home') {
        setIndex(0);
      } else if (e.key === 'End') {
        setIndex(last);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    // 브라우저에서 전체 화면을 끝내면 (Esc) 발표도 끝낸다
    const onFullscreen = () => {
      if (!document.fullscreenElement) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFullscreen);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => undefined);
      }
    };
  }, [last, onClose]);

  return (
    <Presenter ref={ref} role="dialog" aria-label="슬라이드 발표">
      <div onClick={() => setIndex((i) => Math.min(i + 1, last))}>
        <SlideFrame>
          <DocBody>{slides[index]}</DocBody>
          <span className="page">
            {index + 1} / {slides.length}
          </span>
        </SlideFrame>
      </div>
      <div className="controls">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(i - 1, 0))}
          disabled={index === 0}
          aria-label="이전 쪽"
        >
          ◀
        </button>
        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(i + 1, last))}
          disabled={index === last}
          aria-label="다음 쪽"
        >
          ▶
        </button>
        <button type="button" onClick={onClose}>
          끝내기 (Esc)
        </button>
      </div>
    </Presenter>
  );
};

export default SlidePresenter;
