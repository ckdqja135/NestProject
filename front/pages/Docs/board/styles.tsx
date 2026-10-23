import styled from '@emotion/styled';
import { MOBILE } from '@utils/media';

export const BoardWrap = styled.div`
  position: relative;
  height: calc(100vh - 38px - 140px);
  min-height: 460px;
  margin: 0 20px 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;

  /* Excalidraw 가 쓰는 글꼴·색이 앱 전역 스타일과 섞이지 않게 */
  & .excalidraw {
    --ui-font: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Segoe UI', sans-serif;
  }

  & .board-status {
    position: absolute;
    top: 64px;
    left: 50%;
    z-index: 10;
    transform: translateX(-50%);
    padding: 6px 14px;
    border-radius: 16px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    font-size: 13px;
    pointer-events: none;

    &.error {
      background: #e01e5a;
    }
  }

  ${MOBILE} {
    margin: 0 8px 8px;
    height: calc(100vh - 38px - 160px);
  }
`;
