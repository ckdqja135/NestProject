import styled from '@emotion/styled';
import React, { FC, useEffect } from 'react';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;

  & > img {
    max-width: 100%;
    max-height: calc(100vh - 120px);
    border-radius: 4px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }

  & > .bar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 14px;
    color: white;
    font-size: 14px;

    & button {
      border: 1px solid rgba(255, 255, 255, 0.5);
      background: transparent;
      color: white;
      border-radius: 6px;
      padding: 5px 12px;
      cursor: pointer;

      &:hover {
        background: rgba(255, 255, 255, 0.15);
      }
    }
  }
`;

interface Props {
  src: string;
  name: string;
  caption?: string;
  onDownload: () => void;
  onClose: () => void;
}

// 이미지 크게 보기 (Esc 또는 바깥을 누르면 닫힘)
const ImageViewer: FC<Props> = ({ src, name, caption, onDownload, onClose }) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <Overlay role="dialog" aria-label={`${name} 크게 보기`} onClick={onClose}>
      <img src={src} alt={name} onClick={(e) => e.stopPropagation()} />
      <div className="bar" onClick={(e) => e.stopPropagation()}>
        <span>
          {name}
          {caption ? ` · ${caption}` : ''}
        </span>
        <button type="button" onClick={onDownload}>
          기기에 저장
        </button>
        <button type="button" onClick={onClose} aria-label="닫기">
          닫기
        </button>
      </div>
    </Overlay>
  );
};

export default ImageViewer;
