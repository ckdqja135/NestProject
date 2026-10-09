import styled from '@emotion/styled';

export const List = styled.div`
  max-height: 360px;
  overflow-y: auto;
  margin: 0 -4px;
  border-top: 1px solid #eee;
`;

export const ChannelRow = styled.div`
  display: flex;
  align-items: center;
  padding: 10px 4px;
  border-bottom: 1px solid #eee;

  & > div {
    flex: 1;
    display: flex;
    flex-direction: column;

    & small {
      color: #616061;
      margin-top: 2px;
    }
  }

  & button {
    border: 1px solid #ccc;
    background: white;
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
