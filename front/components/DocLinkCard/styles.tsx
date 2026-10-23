import { css } from '@emotion/react';
import styled from '@emotion/styled';
import { Link } from 'react-router-dom';

const card = css`
  display: flex;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
  width: 100%;
  max-width: 420px;
  min-height: 52px;
  margin-top: 6px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  text-decoration: none;

  &:hover {
    background: var(--bg-hover);
  }

  &.loading {
    background: var(--bg-subtle);
  }

  &.denied {
    color: var(--text-muted);
  }

  & .icon {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    background: var(--bg-hover);
  }

  & .text {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;

    & small {
      color: var(--text-muted);
      font-size: 11px;
    }

    & b {
      overflow: hidden;
      color: var(--text);
      font-size: 14px;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
  }

  & .open {
    flex: none;
    color: #1264a3;
    font-size: 12px;
    font-weight: 600;
  }

  & .hint {
    flex: none;
    font-size: 11px;
  }
`;

// 누르면 문서로 가는 카드, 볼 수 없거나 불러오는 중인 카드
export const Card = styled(Link)`
  ${card}
`;
export const CardBox = styled.div`
  ${card}
`;
