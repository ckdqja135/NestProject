import styled from '@emotion/styled';

export const StatusInput = styled.div`
  display: flex;
  gap: 8px;

  & > button {
    flex: 0 0 40px;
    height: 40px;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: var(--bg);
    font-size: 18px;
    cursor: pointer;

    &:hover {
      background: var(--bg-subtle);
    }
  }

  & > input {
    flex: 1;
  }
`;

export const EmojiChoices = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;

  & > button {
    width: 34px;
    height: 34px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    font-size: 18px;
    cursor: pointer;

    &:hover {
      background: var(--bg-hover);
    }

    &.selected {
      border-color: #1264a3;
      background: var(--bg-selected);
    }
  }
`;

export const Presets = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;

  & button {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    font-size: 15px;
    color: var(--text);
    text-align: left;
    cursor: pointer;

    &:hover {
      background: var(--bg-selected);
    }

    & > span:first-of-type {
      font-size: 18px;
    }
  }
`;
