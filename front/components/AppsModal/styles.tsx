import styled from '@emotion/styled';

export const NewApp = styled.form`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;

  & > svg {
    flex: none;
    color: #1264a3;
  }

  & input:first-of-type {
    flex: 0 0 34%;
  }

  & button {
    flex: none;
    padding: 8px 12px;
    border: none;
    border-radius: 6px;
    background: #007a5a;
    color: #fff;
    font-weight: 700;
    cursor: pointer;

    &:disabled {
      opacity: 0.5;
      cursor: default;
    }
  }
`;

export const TokenBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 8px 0 12px;
  padding: 10px 12px;
  border: 1px solid #e8891d;
  border-radius: 8px;
  background: var(--bg-pinned);

  & b {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }

  & code {
    overflow-wrap: anywhere;
    font-size: 12px;
  }

  & div {
    display: flex;
    gap: 6px;
  }

  & button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text);
    cursor: pointer;
  }
`;

export const AppCard = styled.section`
  margin-top: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;

  & > header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: var(--bg-subtle);

    & img {
      width: 32px;
      height: 32px;
      border-radius: 6px;
    }

    & .who {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;

      & small {
        color: var(--text-muted);
      }
    }
  }

  & button {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text);
    font-size: 12px;
    cursor: pointer;

    &.primary {
      border-color: #1264a3;
      background: #1264a3;
      color: #fff;
    }

    &.danger {
      color: #e01e5a;
    }

    &:disabled {
      opacity: 0.5;
      cursor: default;
    }
  }

  & .muted {
    color: var(--text-muted);
    font-size: 12px;
  }

  & .error {
    color: #e01e5a;
    font-size: 12px;
  }
`;

export const Section = styled.div`
  padding: 10px 14px;
  border-top: 1px solid var(--border);

  & h4 {
    margin: 0 0 6px;
    font-size: 13px;
  }

  & .row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 6px 0;

    & input,
    & select {
      flex: 1;
    }
  }

  & select {
    padding: 7px 8px;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text);
    font-size: 13px;
  }

  & .hint {
    margin: 4px 0 0;
    color: var(--text-muted);
    font-size: 12px;
    line-height: 1.5;
  }

  & code {
    padding: 1px 4px;
    border-radius: 4px;
    background: var(--bg-hover);
    font-size: 12px;
  }

  & .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  & .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 4px 2px 8px;
    border-radius: 12px;
    background: var(--bg-selected);
    font-size: 12px;

    & button {
      padding: 2px;
      border: none;
      background: transparent;
    }
  }

  & .checks {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    font-size: 13px;

    & label {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
    }
  }

  & .commands {
    margin: 0 0 6px;
    padding: 0;
    list-style: none;

    & li {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
      font-size: 13px;

      & .url {
        flex: 1;
        overflow: hidden;
        color: var(--text-muted);
        font-size: 11px;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
    }
  }

  & .command-form {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 6px;

    & button {
      justify-self: start;
    }
  }
`;

export const Code = styled.pre`
  margin: 0;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--bg-hover);
  font-size: 11px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;
