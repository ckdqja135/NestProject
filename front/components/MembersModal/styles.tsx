import styled from '@emotion/styled';

export const MemberList = styled.div`
  max-height: 360px;
  overflow-y: auto;
  margin: 0 -8px;

  & > p {
    margin: 12px 8px;
    color: var(--text-muted);
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
    background: var(--bg-subtle);
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
      border: 2px solid var(--bg);
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
      color: var(--text-muted);
    }

    & .badge {
      margin-left: 6px;
      padding: 1px 6px;
      border-radius: 4px;
      background: var(--bg-hover);
      color: var(--text-muted);
      font-size: 11px;
      font-weight: 700;
      vertical-align: middle;
    }

    & small {
      color: var(--text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  & button {
    height: 28px;
    padding: 0 10px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg);
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
