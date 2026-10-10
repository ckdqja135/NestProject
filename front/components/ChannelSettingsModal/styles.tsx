import styled from '@emotion/styled';

export const DangerZone = styled.div`
  border: 1px solid #f3c1cf;
  border-radius: 8px;

  & > .row {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 12px 14px;

    & + .row {
      border-top: 1px solid #f3c1cf;
    }

    & > div {
      flex: 1;
      min-width: 0;
    }

    & strong {
      font-size: 15px;
    }

    & p {
      margin: 4px 0 8px;
      font-size: 13px;
      color: #616061;
    }

    & > button {
      flex: 0 0 auto;
      height: 34px;
      padding: 0 14px;
      border: 1px solid #bbb;
      border-radius: 6px;
      background: white;
      font-weight: 700;
      cursor: pointer;

      &.danger {
        border-color: #e01e5a;
        background: #e01e5a;
        color: white;
      }

      &:disabled {
        opacity: 0.5;
        cursor: default;
      }
    }
  }
`;
