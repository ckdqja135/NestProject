import styled from '@emotion/styled';

export const Bar = styled.div`
  display: flex;
  flex: none;
  align-items: stretch;
  gap: 2px;
  padding: 0 16px;
  overflow-x: auto;
  border-bottom: 1px solid var(--border);
  background: var(--bg);

  & > button,
  & .tab > button:first-of-type {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 220px;
    padding: 8px 10px;
    border: none;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: var(--text-muted);
    font-size: 13px;
    white-space: nowrap;
    cursor: pointer;

    &:hover {
      color: var(--text);
    }
  }

  & > button.on,
  & .tab.on > button:first-of-type {
    border-bottom-color: #1264a3;
    color: var(--text);
    font-weight: 700;
  }

  & .tab {
    position: relative;
    display: flex;
    align-items: center;

    & .label {
      overflow: hidden;
      text-overflow: ellipsis;
    }

    & .more {
      padding: 2px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: var(--text-muted);
      opacity: 0;
      cursor: pointer;
    }

    &:hover .more,
    &.on .more,
    & .more[aria-expanded='true'] {
      opacity: 1;
    }
  }

  & > button.add {
    padding: 8px;
  }
`;

export const TabMenu = styled.div`
  position: fixed;
  z-index: 30;
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 220px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  font-size: 12px;

  & label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: var(--text-muted);

    & select {
      padding: 5px 6px;
      border: 1px solid var(--border-strong);
      border-radius: 6px;
      background: var(--bg);
      color: var(--text);
    }
  }

  & .hint {
    margin: 0;
    color: var(--text-muted);
  }

  & label.check {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 2px 6px;
    color: var(--text);
    cursor: pointer;

    & small {
      grid-column: 2;
      color: var(--text-muted);
    }
  }

  & button {
    padding: 6px 8px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text);
    text-align: left;
    cursor: pointer;

    &:hover {
      background: var(--bg-hover);
    }

    &.danger {
      color: #e01e5a;
    }
  }
`;

export const AddTab = styled.form`
  display: flex;
  flex-direction: column;
  gap: 10px;

  & .modes {
    display: flex;
    gap: 6px;

    & button {
      flex: 1;
      padding: 7px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg);
      color: var(--text);
      cursor: pointer;

      &.on {
        border-color: #1264a3;
        background: var(--bg-selected);
        color: #1264a3;
        font-weight: 700;
      }
    }
  }

  & .types {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;

    & button {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 10px 4px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--bg);
      color: var(--text);
      font-size: 12px;
      cursor: pointer;

      &.on {
        border-color: #1264a3;
        background: var(--bg-selected);
      }
    }
  }

  & .access {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;

    & select {
      flex: 1;
      padding: 6px 8px;
      border: 1px solid var(--border-strong);
      border-radius: 6px;
      background: var(--bg);
      color: var(--text);
    }
  }

  & .hint {
    margin: 0;
    color: var(--text-muted);
    font-size: 12px;
    line-height: 1.5;
  }

  & .docs {
    max-height: 260px;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    list-style: none;
    border: 1px solid var(--border);
    border-radius: 8px;

    & button {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 8px 10px;
      border: none;
      background: transparent;
      color: var(--text);
      text-align: left;
      cursor: pointer;

      & span {
        flex: 1;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      & small {
        color: var(--text-muted);
      }

      &:hover {
        background: var(--bg-hover);
      }

      &.on {
        background: var(--bg-selected);
      }
    }

    & .hint {
      padding: 10px;
    }
  }

  & .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;

    & button {
      padding: 7px 14px;
      border: 1px solid var(--border-strong);
      border-radius: 6px;
      background: var(--bg);
      color: var(--text);
      cursor: pointer;

      &.primary {
        border-color: #007a5a;
        background: #007a5a;
        color: #fff;
        font-weight: 700;
      }

      &:disabled {
        opacity: 0.5;
      }
    }
  }
`;

// 채널 안에서 연 탭 문서 (문서 화면이 스크롤된다)
export const TabDoc = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
`;
