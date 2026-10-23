import { CreateModal, CloseModalButton, ModalHeader } from '@components/Modal/styles';
import React, { FC, PropsWithChildren, useCallback, useEffect, useRef } from 'react';

interface Props {
  show: boolean;
  onCloseModal: () => void;
  title?: string;
  description?: React.ReactNode;
  width?: number; // 기본 480px 보다 넓은 창
}

const Modal: FC<PropsWithChildren<Props>> = ({ show, children, onCloseModal, title, description, width }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  const stopPropagation = useCallback((e) => {
    e.stopPropagation();
  }, []);

  // 닫기 함수가 그릴 때마다 새로 만들어져도 포커스가 첫 칸으로 튀지 않게 따로 둔다
  const closeRef = useRef(onCloseModal);
  closeRef.current = onCloseModal;
  useEffect(() => {
    if (!show) {
      return;
    }
    // 열리면 첫 입력칸에 포커스 (열릴 때 한 번만)
    const firstInput = panelRef.current?.querySelector<HTMLElement>(
      'input:not([type="checkbox"]):not([type="radio"]), textarea',
    );
    firstInput?.focus();
  }, [show]);
  useEffect(() => {
    if (!show) {
      return undefined;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [show]);

  if (!show) {
    return null;
  }
  return (
    <CreateModal onMouseDown={onCloseModal}>
      <div
        ref={panelRef}
        onMouseDown={stopPropagation}
        onClick={stopPropagation}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={width ? { width } : undefined}
      >
        <CloseModalButton type="button" onClick={onCloseModal} aria-label="닫기">
          &times;
        </CloseModalButton>
        {title && (
          <ModalHeader>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </ModalHeader>
        )}
        {children}
      </div>
    </CreateModal>
  );
};

export default Modal;
