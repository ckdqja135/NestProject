import styled from '@emotion/styled';
import { MOBILE } from '@utils/media';

export const Panel = styled.aside`
  width: 380px;
  flex: 0 0 380px;
  display: flex;
  flex-direction: column;
  height: 100%;
  border-left: 1px solid var(--border);
  background: var(--bg);

  ${MOBILE} {
    /* 휴대폰에서는 스레드·고정 패널을 화면 전체로 */
    position: fixed;
    inset: 38px 0 0 0;
    width: 100%;
    z-index: 40;
    border-left: none;
  }
`;

export const PanelHeader = styled.header`
  height: 64px;
  flex: 0 0 64px;
  display: flex;
  align-items: center;
  padding: 0 16px 0 20px;
  border-bottom: 1px solid var(--border);
  font-weight: bold;

  & > span {
    flex: 1;
  }

  & > small {
    font-weight: normal;
    color: var(--text-faint);
    margin-left: 6px;
    flex: 1;
  }

  & > button {
    border: none;
    background: transparent;
    font-size: 24px;
    cursor: pointer;
    line-height: 1;
  }
`;

export const PanelBody = styled.div`
  flex: 1;
  overflow-y: auto;
  min-height: 0;
`;

export const Divider = styled.div`
  display: flex;
  align-items: center;
  margin: 8px 20px;
  font-size: 12px;
  color: var(--text-faint);

  &::after {
    content: '';
    flex: 1;
    border-bottom: 1px solid var(--border);
    margin-left: 8px;
  }
`;

export const EmptyText = styled.p`
  padding: 20px;
  color: var(--text-faint);
  text-align: center;
`;
