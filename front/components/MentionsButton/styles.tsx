import styled from '@emotion/styled';

export const Wrapper = styled.div`
  position: absolute;
  top: 4px;
  right: 56px;
  text-align: left;
`;

export const BellButton = styled.button`
  position: relative;
  height: 30px;
  min-width: 30px;
  padding: 0 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: white;
  font-size: 16px;
  cursor: pointer;

  &:hover,
  &.active {
    background: rgba(255, 255, 255, 0.15);
  }

  & > .count {
    position: absolute;
    top: -2px;
    right: -2px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    box-sizing: border-box;
    border-radius: 9px;
    background: #e01e5a;
    color: white;
    font-size: 11px;
    font-weight: 700;
    line-height: 18px;
    text-align: center;
  }
`;

export const Dropdown = styled.div`
  position: absolute;
  top: 36px;
  right: -48px;
  width: 380px;
  max-width: calc(100vw - 32px);
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  color: var(--text);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  z-index: 1001;
  overflow: hidden;

  & > header {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    font-weight: 800;
    font-size: 15px;

    & > span {
      flex: 1;
    }

    & > button {
      border: none;
      background: transparent;
      color: #1264a3;
      font-size: 13px;
      cursor: pointer;
    }
  }

  & > .notice {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: var(--bg-selected);
    font-size: 13px;
    color: var(--text);

    & > span {
      flex: 1;
    }

    & > button {
      border: 1px solid #1264a3;
      background: var(--bg);
      color: #1264a3;
      border-radius: 4px;
      padding: 3px 8px;
      font-size: 12px;
      cursor: pointer;
    }
  }

  & > .list {
    overflow-y: auto;
  }

  & p.empty {
    margin: 0;
    padding: 24px 16px;
    color: var(--text-muted);
    text-align: center;
    font-size: 14px;
  }
`;

export const MentionItem = styled.button`
  display: block;
  width: 100%;
  border: none;
  border-bottom: 1px solid var(--border);
  background: transparent;
  padding: 10px 16px;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: var(--bg-subtle);
  }

  &.unread {
    background: var(--bg-pinned);
  }

  & .meta {
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: 2px;

    & b {
      color: var(--text);
    }

    /* 저장한 메시지 목록의 저장 취소 버튼 */
    & .remove {
      float: right;
      border: none;
      background: transparent;
      color: var(--text-faint);
      font-size: 16px;
      line-height: 1;
      cursor: pointer;

      &:hover {
        color: #e01e5a;
      }
    }
  }

  & .content {
    font-size: 14px;
    word-break: break-word;
  }
`;
