import styled from '@emotion/styled';

export const MemberList = styled.div`
  max-height: 360px;
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

  & > .avatar {
    position: relative;
    flex: 0 0 36px;

    & img {
      width: 36px;
      height: 36px;
      border-radius: 6px;
      display: block;
    }

    & i {
      position: absolute;
      right: -3px;
      bottom: -3px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: 2px solid white;
      background: #bbb;
    }

    & i.online {
      background: #2bac76;
    }
  }

  & > div {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;

    & .me {
      font-weight: normal;
      color: #616061;
    }

    & .badge {
      margin-left: 6px;
      padding: 1px 6px;
      border-radius: 4px;
      background: #f2f2f2;
      color: #616061;
      font-size: 11px;
      font-weight: 700;
      vertical-align: middle;
    }

    & small {
      color: #616061;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  & button {
    height: 28px;
    padding: 0 10px;
    border-radius: 6px;
    border: 1px solid #ccc;
    background: white;
    font-size: 13px;
    cursor: pointer;
    white-space: nowrap;

    &.outline-danger {
      border-color: #e01e5a;
      color: #e01e5a;
    }

    &.danger {
      border-color: #e01e5a;
      background: #e01e5a;
      color: white;
    }

    &:disabled {
      opacity: 0.6;
    }
  }

  & .confirm {
    display: flex;
    gap: 6px;
  }
`;
