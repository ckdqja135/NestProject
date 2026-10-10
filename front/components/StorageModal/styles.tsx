import styled from '@emotion/styled';

export const Summary = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 10px;
  font-size: 13px;
  color: var(--text-muted);
`;

export const FileList = styled.div`
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 8px;

  & > p {
    margin: 16px;
    color: var(--text-muted);
    font-size: 14px;
  }
`;

export const FileRow = styled.label`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: var(--bg-subtle);
  }

  & .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;

    & b {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 600;
    }

    & small {
      color: var(--text-muted);
    }
  }
`;
