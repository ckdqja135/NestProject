import styled from '@emotion/styled';

export const MemberList = styled.div`
  max-height: 320px;
  overflow-y: auto;
  margin: 0 -8px;

  & > p {
    margin: 12px 8px;
    color: #616061;
    font-size: 14px;
  }
`;

export const MemberRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 6px;

  &:hover {
    background: #f8f8f8;
  }

  & > img {
    width: 32px;
    height: 32px;
    border-radius: 4px;
  }

  & > div {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;

    & small {
      color: #616061;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  & > button {
    height: 30px;
    padding: 0 14px;
    border-radius: 6px;
    border: 1px solid #007a5a;
    background: #007a5a;
    color: white;
    font-weight: 700;
    cursor: pointer;

    &:disabled {
      opacity: 0.6;
      cursor: default;
    }
  }
`;
