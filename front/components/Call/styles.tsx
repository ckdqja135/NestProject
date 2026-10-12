import styled from '@emotion/styled';
import { MOBILE } from '@utils/media';

// 걸려 온 전화 / 통화 중 표시 (오른쪽 아래에 떠 있다)
export const CallCard = styled.div`
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 60;
  width: 300px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
  color: var(--text);

  ${MOBILE} {
    left: 12px;
    right: 12px;
    width: auto;
  }

  & > .who {
    display: flex;
    align-items: center;
    gap: 10px;

    & img {
      width: 40px;
      height: 40px;
      border-radius: 8px;
    }

    & strong {
      display: block;
      font-size: 15px;
    }

    & small {
      color: var(--text-muted);
      font-size: 12px;
    }
  }

  & > .actions {
    display: flex;
    gap: 6px;
    margin-top: 12px;

    & > button {
      flex: 1;
      height: 34px;
      border: 1px solid var(--border-strong);
      border-radius: 8px;
      background: var(--bg);
      color: var(--text);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;

      &.accept {
        border-color: #007a5a;
        background: #007a5a;
        color: white;
      }

      &.hangup {
        border-color: #e01e5a;
        background: #e01e5a;
        color: white;
      }

      &.on {
        background: var(--bg-selected);
        border-color: #1264a3;
      }
    }
  }

  & video {
    width: 100%;
    margin-top: 10px;
    border-radius: 8px;
    background: black;
  }
`;
