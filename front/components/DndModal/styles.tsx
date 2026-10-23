import styled from '@emotion/styled';

export const TimeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;

  & input {
    height: 36px;
    padding: 0 8px;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text);
    font-size: 14px;
  }
`;

export const DayPicker = styled.div`
  display: flex;
  gap: 6px;

  & button {
    width: 36px;
    height: 36px;
    border: 1px solid var(--border-strong);
    border-radius: 50%;
    background: var(--bg);
    color: var(--text);
    font-size: 13px;
    cursor: pointer;

    &.on {
      border-color: #1264a3;
      background: #1264a3;
      color: white;
    }

    &:disabled {
      opacity: 0.5;
      cursor: default;
    }
  }
`;
