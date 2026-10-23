import styled from '@emotion/styled';
import { MOBILE } from '@utils/media';

// 문서 댓글 창 (오른쪽에 붙는다)
export const Panel = styled.aside`
  position: fixed;
  top: 38px;
  right: 0;
  bottom: 0;
  z-index: 35;
  display: flex;
  flex-direction: column;
  width: min(380px, 100%);
  border-left: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.1);

  & > header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border);

    & .tabs {
      display: flex;
      gap: 2px;
      margin-left: 8px;

      & button {
        padding: 3px 8px;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: var(--text-muted);
        font-size: 12px;
        cursor: pointer;

        &.on {
          background: var(--bg-hover);
          color: var(--text);
          font-weight: 700;
        }
      }
    }

    & .close {
      display: inline-flex;
      margin-left: auto;
      padding: 4px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;

      &:hover {
        background: var(--bg-hover);
      }
    }
  }

  & .list {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
  }

  & .thread {
    margin-bottom: 10px;
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg);

    &.active {
      border-color: #e8a01d;
      box-shadow: 0 0 0 2px rgba(232, 160, 29, 0.2);
    }

    &.page-comment {
      border-style: dashed;
    }

    & blockquote {
      margin: 0 0 8px;
      padding: 2px 8px;
      border-left: 3px solid #e8a01d;
      color: var(--text-muted);
      font-size: 13px;
      cursor: pointer;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
    }
  }

  & .comment {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;

    & img,
    & .avatar-blank {
      flex: none;
      width: 26px;
      height: 26px;
      border-radius: 6px;
      background: var(--bg-hover);
    }

    & .body {
      flex: 1;
      min-width: 0;
    }

    & .meta {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;

      & span {
        color: var(--text-faint);
      }

      & .actions {
        display: none;
        margin-left: auto;
        gap: 2px;

        & button {
          display: inline-flex;
          padding: 3px;
          border: none;
          border-radius: 4px;
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;

          &:hover {
            background: var(--bg-hover);
          }
        }
      }
    }

    &:hover .meta .actions {
      display: inline-flex;
    }

    & p {
      margin: 2px 0 0;
      font-size: 14px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }
  }

  & .thread-actions {
    display: flex;
    justify-content: flex-end;

    & button {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg);
      color: var(--text-muted);
      font-size: 12px;
      cursor: pointer;

      &:hover {
        color: var(--text);
        background: var(--bg-hover);
      }
    }
  }

  & .composer,
  & .edit {
    margin-top: 8px;

    & textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 8px 10px;
      border: 1px solid var(--border-strong);
      border-radius: 8px;
      background: var(--bg);
      color: var(--text);
      font: inherit;
      font-size: 14px;
      resize: vertical;
      outline: none;

      &:focus {
        border-color: #1264a3;
        box-shadow: 0 0 0 3px rgba(29, 155, 209, 0.2);
      }
    }
  }

  & .composer-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    margin-top: 4px;

    & button {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg);
      color: var(--text);
      font-size: 12px;
      cursor: pointer;

      &.primary {
        border-color: #1264a3;
        background: #1264a3;
        color: white;
      }

      &:disabled {
        opacity: 0.5;
        cursor: default;
      }
    }
  }

  & .empty {
    margin: 24px 0;
    text-align: center;
    color: var(--text-muted);
    font-size: 13px;
  }

  ${MOBILE} {
    width: 100%;
  }
`;
