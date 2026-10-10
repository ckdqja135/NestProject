import styled from '@emotion/styled';

export const List = styled.div`
  max-height: 360px;
  overflow-y: auto;
  margin: 0 -4px;
  border-top: 1px solid var(--border);
`;

export const ChannelRow = styled.div`
  display: flex;
  align-items: center;
  padding: 10px 4px;
  border-bottom: 1px solid var(--border);

  & > div {
    flex: 1;
    display: flex;
    flex-direction: column;

    & small {
      color: var(--text-muted);
      margin-top: 2px;
    }
  }

  & button {
    border: 1px solid var(--border);
    background: var(--bg);
    border-radius: 4px;
    padding: 4px 12px;
    cursor: pointer;

    &.primary {
      background: #007a5a;
      border-color: #007a5a;
      color: white;
    }

    &:disabled {
      opacity: 0.6;
    }
  }
`;
