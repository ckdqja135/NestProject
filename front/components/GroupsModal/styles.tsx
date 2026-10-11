import styled from '@emotion/styled';

export const GroupList = styled.ul`
  list-style: none;
  margin: 0 0 16px;
  padding: 0;
  max-height: 40vh;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 8px;

  & > li {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);

    &:last-child {
      border-bottom: none;
    }
  }

  & .row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  & .name {
    flex: 1;
    min-width: 0;
    font-weight: 700;
  }

  & .desc,
  & .members {
    margin-top: 2px;
    font-size: 12px;
    color: var(--text-muted);
  }

  & .empty {
    color: var(--text-muted);
    font-size: 14px;
  }

  & button {
    flex: 0 0 auto;
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    background: var(--bg);
    color: var(--text);
    padding: 2px 8px;
    font-size: 12px;
    cursor: pointer;

    &.danger {
      border-color: #e01e5a;
      color: #e01e5a;
    }
  }
`;

export const MemberChecks = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  max-height: 140px;
  overflow-y: auto;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;

  & label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    cursor: pointer;
  }
`;
