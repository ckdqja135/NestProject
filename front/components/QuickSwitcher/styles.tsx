import styled from '@emotion/styled';

export const SearchInput = styled.input`
  width: 100%;
  box-sizing: border-box;
  height: 44px;
  padding: 0 14px;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  font-size: 16px;
  outline: none;

  &:focus {
    border-color: #1264a3;
    box-shadow: 0 0 0 3px rgba(29, 155, 209, 0.3);
  }
`;

export const ResultList = styled.ul`
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  max-height: 320px;
  overflow-y: auto;

  & > li > button {
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

    &.active {
      background: #1264a3;
      color: white;

      & small {
        color: rgba(255, 255, 255, 0.8);
      }
    }

    & img {
      width: 20px;
      height: 20px;
      border-radius: 4px;
    }

    & .icon {
      width: 20px;
      text-align: center;
    }

    & small {
      margin-left: auto;
      color: var(--text-muted);
      font-size: 12px;
    }
  }

  & > li.empty {
    padding: 12px 10px;
    color: var(--text-muted);
    font-size: 14px;
  }
`;
