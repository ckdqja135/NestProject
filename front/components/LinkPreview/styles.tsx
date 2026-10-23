import styled from '@emotion/styled';

export const Card = styled.a`
  display: flex;
  gap: 12px;
  max-width: 520px;
  margin-top: 6px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-left: 4px solid var(--border-strong);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text);
  text-decoration: none;

  &:hover {
    background: var(--bg-subtle);

    & .title {
      text-decoration: underline;
    }
  }

  & .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  & .site {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--text-muted);
  }

  & .title {
    color: #1264a3;
    font-size: 14px;
    line-height: 1.35;
  }

  & .desc {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: 13px;
    line-height: 1.4;
    color: var(--text-muted);
  }

  & img {
    flex: none;
    width: 80px;
    height: 80px;
    border-radius: 6px;
    object-fit: cover;
    background: var(--bg-subtle);
  }
`;
