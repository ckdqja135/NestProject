import styled from '@emotion/styled';

const PHONE = '@media (max-width: 600px)';

export const CreateModal = styled.div`
  position: fixed;
  left: 0;
  bottom: 0;
  top: 0;
  right: 0;
  z-index: 1022;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 10vh 16px 16px;
  background: rgba(15, 17, 26, 0.48);
  backdrop-filter: blur(3px);
  overflow-y: auto;
  animation: modal-fade 140ms ease-out;

  & > div {
    width: 480px;
    max-width: 100%;
    box-sizing: border-box;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 14px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.28), 0 2px 8px rgba(0, 0, 0, 0.08);
    padding: 24px 28px 26px;
    position: relative;
    text-align: left;
    color: var(--text);
    animation: modal-in 180ms cubic-bezier(0.2, 0.9, 0.3, 1.2);
  }

  @keyframes modal-fade {
    from {
      opacity: 0;
    }
  }

  @keyframes modal-in {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  @keyframes modal-sheet {
    from {
      transform: translateY(40px);
      opacity: 0.6;
    }
  }

  /* 휴대폰: 아래에서 올라오는 시트 */
  ${PHONE} {
    align-items: flex-end;
    padding: 0;

    & > div {
      width: 100% !important;
      max-height: 92vh;
      overflow-y: auto;
      border-radius: 18px 18px 0 0;
      padding: 22px 18px 28px;
      animation: modal-sheet 200ms ease-out;
    }
  }
`;

export const CloseModalButton = styled.button`
  position: absolute;
  right: 16px;
  top: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: 50%;
  color: var(--text-muted);
  cursor: pointer;
  transition: background 100ms ease-out, color 100ms ease-out;

  &:hover {
    background: var(--bg-hover);
    color: var(--text);
  }
`;

export const ModalHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 20px;
  padding-right: 36px;

  & > .icon {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 11px;
    background: linear-gradient(135deg, #7c5cff, #3d8bfd);
    color: #fff;
    box-shadow: 0 6px 16px rgba(92, 92, 255, 0.3);
  }

  & h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.2px;
  }

  & p {
    margin: 6px 0 0;
    font-size: 13.5px;
    color: var(--text-muted);
    line-height: 1.55;
  }
`;
