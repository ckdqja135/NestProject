import styled from '@emotion/styled';

export const Rsvp = styled.div`
  display: flex;
  gap: 6px;
  margin-top: 4px;

  & button {
    padding: 3px 12px;
    border: 1px solid var(--border-strong);
    border-radius: 14px;
    background: var(--bg);
    color: var(--text);
    font-size: 12px;
    cursor: pointer;

    &.on {
      border-color: #007a5a;
      background: #007a5a;
      color: white;
    }
  }
`;
