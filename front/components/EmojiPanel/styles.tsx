import styled from '@emotion/styled';

export const Panel = styled.div`
  width: 320px;
  max-width: calc(100vw - 24px);
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
  text-align: left;

  & > input {
    width: 100%;
    box-sizing: border-box;
    height: 32px;
    padding: 0 10px;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text);
    font-size: 14px;
    outline: none;
  }

  & > .tabs {
    display: flex;
    gap: 2px;
    margin: 6px 0 4px;
    overflow-x: auto;

    & > button {
      flex: 0 0 auto;
      border: none;
      border-radius: 4px;
      background: transparent;
      padding: 2px 4px;
      font-size: 16px;
      cursor: pointer;

      &.active,
      &:hover {
        background: var(--bg-hover);
      }
    }
  }

  & > .body {
    height: 240px;
    overflow-y: auto;
  }

  & h4 {
    margin: 6px 2px 2px;
    font-size: 12px;
    color: var(--text-muted);
  }

  & .grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);

    & > button {
      height: 34px;
      border: none;
      border-radius: 6px;
      background: transparent;
      font-size: 20px;
      cursor: pointer;

      &:hover {
        background: var(--bg-hover);
      }

      & img {
        width: 22px;
        height: 22px;
        object-fit: contain;
      }
    }
  }

  & .empty {
    padding: 16px 4px;
    color: var(--text-muted);
    font-size: 13px;
  }
`;
