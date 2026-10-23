import styled from '@emotion/styled';

// 사이드바 섹션 (채널 목록과 같은 모양, 끌어다 놓을 때 테두리)
export const SectionBlock = styled.div`
  border-radius: 6px;

  &.over {
    box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.5);
  }

  & h2 {
    position: relative;

    & .tools {
      display: none;
      margin-left: auto;
      padding-right: 10px;

      & button {
        padding: 2px 4px;
        border: none;
        background: transparent;
        color: rgb(188, 171, 188);
        cursor: pointer;
      }
    }

    &:hover .tools {
      display: inline-flex;
    }
  }

  & .section-name-input {
    width: 150px;
    height: 22px;
    padding: 0 6px;
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.2);
    color: white;
    font-size: 14px;
    outline: none;
  }

  & .empty {
    margin: 2px 0 6px;
    padding: 0 16px 0 36px;
    color: rgba(188, 171, 188, 0.7);
    font-size: 12px;
  }

  & .add-section {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin: 4px 0;
    padding: 4px 16px 4px 20px;
    border: none;
    background: transparent;
    color: rgb(188, 171, 188);
    font-size: 13px;
    cursor: pointer;

    &:hover {
      color: white;
    }
  }
`;

// 오른쪽 클릭 메뉴 (섹션으로 옮기기)
export const ItemMenu = styled.div`
  position: fixed;
  z-index: 1000;
  min-width: 180px;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  color: var(--text);

  & .title {
    padding: 6px 10px 4px;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 700;
  }

  & button {
    display: block;
    width: 100%;
    padding: 6px 10px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: inherit;
    font-size: 13px;
    text-align: left;
    cursor: pointer;

    &:hover:not(:disabled) {
      background: #1264a3;
      color: white;
    }

    &:disabled {
      color: var(--text-muted);
      cursor: default;
    }
  }
`;
