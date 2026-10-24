import styled from '@emotion/styled';

export const Buttons = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;

  & button {
    padding: 5px 12px;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;

    &:hover:not(:disabled) {
      background: var(--bg-hover);
    }

    &.primary {
      border-color: #007a5a;
      background: #007a5a;
      color: #fff;
    }

    &.danger {
      border-color: #e01e5a;
      color: #e01e5a;
    }

    &:disabled {
      opacity: 0.6;
      cursor: default;
    }
  }
`;
