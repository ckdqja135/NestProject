import { CreateModal, CloseModalButton, ModalHeader } from '@components/Modal/styles';
import React, { FC, PropsWithChildren, useCallback, useEffect, useRef } from 'react';

interface Props {
  show: boolean;
  onCloseModal: () => void;
  title?: string;
  description?: React.ReactNode;
}

const Modal: FC<PropsWithChildren<Props>> = ({ show, children, onCloseModal, title, description }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  const stopPropagation = useCallback((e) => {
    e.stopPropagation();
  }, []);

  useEffect(() => {
    if (!show) {
      return;
    }
    // 열리면 첫 입력칸에 포커스, Esc 로 닫기
    const firstInput = panelRef.current?.querySelector<HTMLElement>(
      'input:not([type="checkbox"]):not([type="radio"]), textarea',
    );
    firstInput?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseModal();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [show, onCloseModal]);

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
