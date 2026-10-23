import styled from '@emotion/styled';

export const Card = styled.div`
  max-width: 560px;
  margin-top: 4px;
  padding: 6px 12px 8px;
  border-left: 4px solid var(--border-strong);
  border-radius: 4px;
  background: var(--bg-subtle);

  & .head {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--text-muted);
  }

  & .from {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-top: 2px;
    font-size: 14px;

    & span {
      font-size: 12px;
      color: var(--text-muted);
    }
  }

  & .body {
    margin-top: 2px;
    word-break: break-word;

    & .gif {
      max-height: 160px;
      max-width: 100%;
      border-radius: 4px;
    }
  }

  & .origin {
    display: inline-block;
    margin-top: 4px;
    font-size: 12px;
    color: #1264a3;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`;
