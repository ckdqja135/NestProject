import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import React, { FC, useEffect, useRef, useState } from 'react';
import { H, Slide, W } from './slides/model';
import SlideView from './slides/SlideView';
import { Presenter } from './styles';

interface Props {
  slides: Slide[];
  start: number;
  workspace: string;
  emojis?: Record<string, string>;
  onClose: () => void;
}

const fitScale = () => Math.min((window.innerWidth * 0.96) / W, (window.innerHeight * 0.92) / H);

// 발표 모드: 전체 화면, ← → 로 넘기고 Esc 로 끝낸다
const SlidePresenter: FC<Props> = ({ slides, start, workspace, emojis, onClose }) => {
  const [index, setIndex] = useState(start);
  const [scale, setScale] = useState(fitScale);
  const ref = useRef<HTMLDivElement>(null);
  const last = slides.length - 1;

  useEffect(() => {
    const el = ref.current;
    el?.requestFullscreen?.().catch(() => {
      // 전체 화면을 못 쓰면 창 안에서 발표한다
    });
    const onResize = () => setScale(fitScale());
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, last));
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) {
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
    window.addEventListener('resize', onResize);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onFullscreen);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => undefined);
      }
    };
  }, [last, onClose]);

  const slide = slides[Math.min(index, last)];
  return (
    <Presenter ref={ref} role="dialog" aria-label="슬라이드 발표">
      <div onClick={() => setIndex((i) => Math.min(i + 1, last))} className="stage">
        {slide && <SlideView slide={slide} scale={scale} workspace={workspace} emojis={emojis} />}
      </div>
      <div className="controls">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(i - 1, 0))}
          disabled={index === 0}
          aria-label="이전 쪽"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="page">
          {index + 1} / {slides.length}
        </span>
        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(i + 1, last))}
          disabled={index === last}
          aria-label="다음 쪽"
        >
          <ChevronRight size={18} />
        </button>
        <button type="button" onClick={onClose} aria-label="발표 끝내기">
          <X size={16} /> 끝내기
        </button>
      </div>
    </Presenter>
  );
};

export default SlidePresenter;
