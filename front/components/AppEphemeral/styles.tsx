import styled from '@emotion/styled';

export const List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 40vh;
  margin: 0 20px 8px;
  padding: 0;
  overflow-y: auto;
  list-style: none;

  & li {
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-left: 3px solid #1264a3;
    border-radius: 6px;
    background: var(--bg-subtle);
    font-size: 14px;

    &.error {
      border-left-color: #e01e5a;
    }
  }

  & header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 2px;
    font-size: 13px;

    & span {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      color: var(--text-muted);
      font-size: 11px;
    }

    & button {
      margin-left: auto;
      padding: 2px;
      border: none;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
    }
  }

  & .text {
    white-space: pre-wrap;
    word-break: break-word;
  }
`;
