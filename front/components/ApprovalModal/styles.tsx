import styled from '@emotion/styled';

export const BodyInput = styled.textarea`
  width: 100%;
  box-sizing: border-box;
  padding: 8px 12px;
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text);
  font: inherit;
  font-size: 14px;
  resize: vertical;
`;

export const Approvers = styled.ol`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0 0 6px;
  padding: 0;
  list-style: none;

  & li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 6px;
    border: 1px solid var(--border);
    border-radius: 6px;

    & .order {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #e8891d;
      color: white;
      font-size: 11px;
      font-weight: 700;
      line-height: 18px;
      text-align: center;
    }

    & img {
      width: 22px;
      height: 22px;
      border-radius: 50%;
    }

    & .name {
      flex: 1;
      font-size: 14px;
    }

    & button {
      display: inline-flex;
      padding: 3px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;

      &:hover:not(:disabled) {
        background: var(--bg-hover);
      }

      &:disabled {
        opacity: 0.3;
        cursor: default;
      }
    }
  }
`;
