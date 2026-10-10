import styled from '@emotion/styled';

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
  padding: 12vh 16px 16px;
  background: rgba(0, 0, 0, 0.45);
  overflow-y: auto;

  & > div {
    width: 480px;
    max-width: 100%;
    box-sizing: border-box;
    background: var(--bg);
    border-radius: 8px;
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.3);
    padding: 24px 28px 24px;
    position: relative;
    text-align: left;
    color: var(--text);
    animation: modal-in 120ms ease-out;
  }

  @keyframes modal-in {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
`;

export const CloseModalButton = styled.button`
  position: absolute;
  right: 14px;
  top: 12px;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: 4px;
  font-size: 26px;
  line-height: 1;
  color: var(--text-muted);
  cursor: pointer;

  &:hover {
    background: var(--bg-hover);
    color: var(--text);
  }
`;

export const ModalHeader = styled.div`
  margin-bottom: 20px;
  padding-right: 32px;

  & > h2 {
    margin: 0;
    font-size: 22px;
    font-weight: 800;
  }

  & > p {
    margin: 6px 0 0;
    font-size: 14px;
    color: var(--text-muted);
    line-height: 1.5;
  }
`;
