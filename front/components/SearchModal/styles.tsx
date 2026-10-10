import styled from '@emotion/styled';
import { MOBILE } from '@utils/media';

export const SearchForm = styled.form`
  display: inline-block;

  & input {
    width: 420px;
    max-width: 40vw;

    ${MOBILE} {
      /* 오른쪽 아이콘(🧵🔖🔔, 프로필)과 겹치지 않게 */
      width: calc(100vw - 230px);
      max-width: none;
    }
    height: 26px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.15);
    color: white;
    padding: 0 10px;
    font-size: 13px;
    outline: none;

    &::placeholder {
      color: rgba(255, 255, 255, 0.7);
    }

    &:focus {
      background: var(--bg);
      color: var(--text);
    }
  }
`;

export const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1022;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 60px;
  text-align: left;
  color: var(--text);
`;

export const ResultBox = styled.div`
  width: 640px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
  background: var(--bg);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);

  & > header {
    display: flex;
    align-items: center;
    padding: 14px 20px;
    border-bottom: 1px solid var(--border);
    font-weight: bold;

    & > span {
      flex: 1;
    }

    & > button {
      border: none;
      background: transparent;
      font-size: 24px;
      cursor: pointer;
      line-height: 1;
    }
  }

  & > div {
    overflow-y: auto;
    padding-bottom: 8px;
  }

  & h3 {
    font-size: 13px;
    color: var(--text-muted);
    margin: 14px 20px 6px;
  }

  & p.empty {
    padding: 8px 20px;
    color: var(--text-faint);
    margin: 0;
  }
`;

export const ResultItem = styled.button`
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 8px 20px;
  cursor: pointer;

  &:hover {
    background: var(--bg-subtle);
  }

  & .meta {
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: 2px;

    & b {
      color: var(--text);
    }
  }

  & .content {
    font-size: 14px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  & mark {
    background: var(--bg-highlight);
    padding: 0;
  }
`;
