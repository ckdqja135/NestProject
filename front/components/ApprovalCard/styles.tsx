import styled from '@emotion/styled';

export const Card = styled.section`
  box-sizing: border-box;
  width: 100%;
  max-width: 440px;
  margin-top: 4px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-left: 4px solid #e8891d;
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);

  &.status-approved {
    border-left-color: #007a5a;
  }

  &.status-rejected {
    border-left-color: #e01e5a;
  }

  &.status-canceled {
    border-left-color: var(--border-strong);
    opacity: 0.8;
  }

  &.loading {
    min-height: 90px;
    background: var(--bg-subtle);
  }

  &.denied {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--text-muted);
    font-size: 13px;
  }

  & header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;

    & .kind {
      color: var(--text-muted);
      font-size: 12px;
      font-weight: 700;
    }

    & .status {
      padding: 1px 8px;
      border-radius: 10px;
      background: rgba(232, 137, 29, 0.15);
      color: #b8640b;
      font-size: 11px;
      font-weight: 700;

      &.approved {
        background: rgba(0, 122, 90, 0.12);
        color: #007a5a;
      }

      &.rejected {
        background: rgba(224, 30, 90, 0.12);
        color: #e01e5a;
      }

      &.canceled {
        background: var(--bg-hover);
        color: var(--text-muted);
      }
    }
  }

  & .title {
    display: block;
    font-size: 15px;
  }

  & .by {
    color: var(--text-muted);
    font-size: 12px;
  }

  & dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 12px;
    margin: 8px 0 0;
    font-size: 13px;

    & dt {
      color: var(--text-muted);
    }

    & dd {
      margin: 0;
    }
  }

  & .body {
    margin: 8px 0 0;
    font-size: 13px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }

  & .steps {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 10px 0 0;
    padding: 0;
    list-style: none;

    & li {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 3px 8px 3px 3px;
      border: 1px solid var(--border);
      border-radius: 14px;
      font-size: 12px;

      & img {
        width: 20px;
        height: 20px;
        border-radius: 50%;
      }

      & .state {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        color: var(--text-muted);
      }

      & .comment {
        color: var(--text-muted);
        font-style: italic;
      }

      &.approved .state {
        color: #007a5a;
      }

      &.rejected .state {
        color: #e01e5a;
      }

      &.pending {
        border-color: #e8891d;

        & .state {
          color: #b8640b;
          font-weight: 700;
        }
      }
    }
  }

  & .actions,
  & .reject-form {
    display: flex;
    gap: 6px;
    margin-top: 10px;

    & button {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 5px 12px;
      border: 1px solid var(--border-strong);
      border-radius: 6px;
      background: var(--bg);
      color: var(--text);
      font-size: 13px;
      cursor: pointer;

      &.approve {
        border-color: #007a5a;
        background: #007a5a;
        color: white;
      }

      &.reject {
        border-color: #e01e5a;
        color: #e01e5a;
      }

      &:disabled {
        opacity: 0.5;
        cursor: default;
      }
    }

    & input {
      flex: 1;
      min-width: 0;
      padding: 5px 8px;
      border: 1px solid var(--border-strong);
      border-radius: 6px;
      background: var(--bg);
      color: var(--text);
      font-size: 13px;
    }
  }
`;
