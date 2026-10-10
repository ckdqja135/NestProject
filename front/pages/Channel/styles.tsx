import styled from '@emotion/styled';
import { MOBILE } from '@utils/media';

export const Container = styled.div`
  display: flex;
  flex-wrap: wrap;
  height: calc(100vh - 38px);
  flex-flow: column;
  position: relative;
  flex: 1;
  min-width: 0;
`;

export const Header = styled.header`
  height: 64px;
  display: flex;
  width: 100%;
  --saf-0: rgba(var(--sk_foreground_low, 29, 28, 29), 0.13);
  box-shadow: 0 1px 0 var(--saf-0);
  padding: 20px 16px 20px 20px;
  font-weight: bold;
  align-items: center;
  min-width: 0;

  ${MOBILE} {
    padding: 12px 10px;

    /* 좁은 화면에서는 주제를 숨기고 버튼을 작게 */
    & > .topic {
      display: none;
    }

    & button {
      padding: 3px 6px;
      font-size: 12px;
    }
  }

  & > .name {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  /* 채널 주제: 누르면 채널 설정이 열린다 */
  & > .topic {
    min-width: 0;
    margin-left: 12px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 13px;
    font-weight: normal;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;

    &:hover {
      color: var(--text);
    }
  }

  & > .archived {
    flex: 0 0 auto;
    margin-left: 8px;
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--bg-hover);
    color: var(--text-muted);
    font-size: 12px;
    font-weight: normal;
  }
`;

// 보관된 채널: 입력창 대신 안내
export const ArchivedNotice = styled.div`
  margin: 0 20px 20px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-subtle);
  color: var(--text-muted);
  font-size: 14px;
  text-align: center;

  & button {
    margin-left: 8px;
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    background: var(--bg);
    padding: 3px 10px;
    cursor: pointer;
  }
`;

export const DragOver = styled.div`
  position: absolute;
  top: 64px;
  left: 0;
  width: 100%;
  height: calc(100% - 64px);
  background: var(--bg);
  opacity: 0.7;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
`;

export const Layout = styled.div`
  display: flex;
  height: calc(100vh - 38px);
`;

export const HeaderButton = styled.button`
  border: 1px solid var(--border);
  background: var(--bg);
  border-radius: 4px;
  padding: 3px 10px;
  font-size: 13px;
  cursor: pointer;
  margin-right: 4px;

  &:hover,
  &.active {
    background: var(--bg-hover);
  }
`;
