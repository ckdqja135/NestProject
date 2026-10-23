import styled from '@emotion/styled';

export const Picker = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;

  & .original {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
    padding: 8px 12px;
    border-left: 4px solid var(--border-strong);
    border-radius: 4px;
    background: var(--bg-subtle);
    font-size: 13px;

    & span {
      color: var(--text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  & .search {
    position: relative;
    display: flex;
    align-items: center;

    & svg {
      position: absolute;
      left: 10px;
      color: var(--text-faint);
      pointer-events: none;
    }

    & input {
      width: 100%;
      height: 38px;
      padding: 0 10px 0 32px;
      border: 1px solid var(--border-strong);
      border-radius: 6px;
      background: var(--bg);
      color: var(--text);
      font-size: 14px;
      outline: none;

      &:focus {
        border-color: #1264a3;
        box-shadow: 0 0 0 3px rgba(29, 155, 209, 0.3);
      }
    }
  }

  & .list {
    max-height: 240px;
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 4px 0;

    & .group {
      padding: 6px 12px 2px;
      font-size: 11px;
      font-weight: 700;
      color: var(--text-muted);
    }

    & button {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 6px 12px;
      border: none;
      background: transparent;
      color: var(--text);
      font-size: 14px;
      text-align: left;
      cursor: pointer;

      &:hover {
        background: var(--bg-hover);
      }

      &.on {
        background: var(--bg-selected);
        color: #1264a3;
        font-weight: 700;
      }

      & img {
        width: 22px;
        height: 22px;
        border-radius: 5px;
      }

      & small {
        color: var(--text-muted);
        font-weight: normal;
      }
    }

    & .empty {
      margin: 10px 12px;
      font-size: 13px;
      color: var(--text-muted);
    }
  }

  & textarea {
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
    outline: none;

    &:focus {
      border-color: #1264a3;
      box-shadow: 0 0 0 3px rgba(29, 155, 209, 0.3);
    }
  }
`;
