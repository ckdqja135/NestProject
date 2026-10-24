import styled from '@emotion/styled';

const PHONE = '@media (max-width: 760px)';
const ACCENT = '#5b5bf0';

// 왼쪽 앱 목록 + 오른쪽 상세
export const Layout = styled.div`
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 18px;
  min-height: 520px;

  ${PHONE} {
    grid-template-columns: 1fr;
    min-height: 0;
  }
`;

export const AppList = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 64vh;
  padding: 6px;
  overflow-y: auto;
  border-radius: 12px;
  background: var(--bg-subtle);

  ${PHONE} {
    flex-direction: row;
    max-height: none;
    overflow-x: auto;
  }

  & > button {
    display: flex;
    flex: none;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border: 1px solid transparent;
    border-radius: 10px;
    background: transparent;
    color: var(--text);
    text-align: left;
    cursor: pointer;
    transition: background 100ms ease-out;

    &:hover {
      background: var(--bg-hover);
    }

    &.on {
      border-color: var(--border);
      background: var(--bg);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }

    & img {
      flex: none;
      width: 34px;
      height: 34px;
      border-radius: 9px;
    }

    & .text {
      display: flex;
      flex-direction: column;
      min-width: 0;

      & b {
        overflow: hidden;
        font-size: 14px;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      & small {
        display: flex;
        align-items: center;
        gap: 5px;
        color: var(--text-muted);
        font-size: 11.5px;
      }
    }

    &.new {
      justify-content: center;
      gap: 6px;
      margin-bottom: 4px;
      border: 1px dashed var(--border-strong);
      color: ${ACCENT};
      font-weight: 700;

      &.on {
        border-style: solid;
        border-color: ${ACCENT};
        background: rgba(91, 91, 240, 0.08);
        box-shadow: none;
      }
    }
  }

  & .dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--text-faint);

    &.ok {
      background: #2eb67d;
    }

    &.error {
      background: #e01e5a;
    }
  }

  & .empty {
    margin: 8px;
    color: var(--text-muted);
    font-size: 12px;
  }
`;

export const Pill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--bg-hover);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  vertical-align: middle;

  &.bot {
    background: rgba(91, 91, 240, 0.12);
    color: ${ACCENT};
  }

  &.ok {
    background: rgba(46, 182, 125, 0.14);
    color: #1d8a5c;
  }

  &.error {
    background: rgba(224, 30, 90, 0.12);
    color: #c0164b;
  }
`;

export const Detail = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  max-height: 64vh;

  ${PHONE} {
    max-height: none;
  }

  & > .panel {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
    padding-right: 4px;
    overflow-y: auto;
  }

  & .hero {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px;
    border-radius: 14px;
    background: linear-gradient(135deg, rgba(124, 92, 255, 0.12), rgba(61, 139, 253, 0.08));

    & > img {
      flex: none;
      width: 56px;
      height: 56px;
      border-radius: 14px;
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
    }

    & .who {
      flex: 1;
      min-width: 0;

      & h3 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        font-size: 18px;
      }

      & p {
        margin: 3px 0 6px;
        color: var(--text-muted);
        font-size: 13px;
      }

      & .meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
        color: var(--text-muted);
        font-size: 12px;

        & span {
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }
      }
    }

    & .danger-zone {
      display: flex;
      flex: none;
      gap: 6px;
    }
  }

  & .warn {
    margin: 0;
    padding: 8px 12px;
    border-radius: 8px;
    background: var(--bg-danger);
    color: #b0123d;
    font-size: 13px;
  }

  & button {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    background: var(--bg);
    color: var(--text);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 80ms ease-out;

    &:hover:not(:disabled) {
      background: var(--bg-hover);
    }

    &.primary {
      border-color: ${ACCENT};
      background: ${ACCENT};
      color: #fff;

      &:hover:not(:disabled) {
        background: #4848d8;
      }
    }

    &.danger {
      color: #e01e5a;

      &.solid {
        border-color: #e01e5a;
        background: #e01e5a;
        color: #fff;
      }
    }

    &.icon {
      padding: 5px;
      border: none;
      background: transparent;
      color: var(--text-muted);
    }

    &:disabled {
      opacity: 0.5;
      cursor: default;
    }
  }

  & .save-row {
    display: flex;
    justify-content: flex-end;
  }

  & select.select {
    flex: 1;
    height: 38px;
    padding: 0 10px;
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    background: var(--bg);
    color: var(--text);
    font-size: 14px;
  }
`;

export const Tabs = styled.div`
  display: flex;
  gap: 4px;
  padding: 4px;
  overflow-x: auto;
  border-radius: 10px;
  background: var(--bg-subtle);

  & > button {
    flex: 1;
    justify-content: center;
    padding: 7px 10px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    white-space: nowrap;

    &.on {
      background: var(--bg);
      color: var(--text);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
    }
  }
`;

export const Card = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg);

  & h4 {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    font-size: 14px;
  }

  & .hint {
    margin: -4px 0 0;
    color: var(--text-muted);
    font-size: 12.5px;
    line-height: 1.55;
  }

  & code {
    padding: 1px 5px;
    border: none;
    border-radius: 5px;
    background: rgba(91, 91, 240, 0.1);
    color: #5b5bf0;
    font-size: 12px;
  }

  & .row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  & code.mono {
    background: var(--bg-subtle);
    border: 1px solid var(--border);
    color: var(--text);
    flex: 1;
    min-width: 0;
    padding: 8px 10px;
    overflow: hidden;
    border-radius: 8px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12.5px;
    letter-spacing: 0.3px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  & .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;

    & .empty {
      color: var(--text-muted);
      font-size: 13px;
    }
  }

  & .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 4px 4px 10px;
    border-radius: 999px;
    background: rgba(91, 91, 240, 0.1);
    color: ${ACCENT};
    font-size: 13px;
    font-weight: 600;

    & button {
      padding: 3px;
      border: none;
      border-radius: 50%;
      background: transparent;
      color: inherit;
    }
  }

  & .toggles {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;

    ${PHONE} {
      grid-template-columns: 1fr;
    }

    & label {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 10px;
      border: 1px solid var(--border);
      border-radius: 10px;
      cursor: pointer;
      transition: border 80ms ease-out, background 80ms ease-out;

      &.on {
        border-color: ${ACCENT};
        background: rgba(91, 91, 240, 0.06);
      }

      & input {
        margin-top: 2px;
        accent-color: ${ACCENT};
      }

      & span {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: 13px;
      }

      & small {
        color: var(--text-muted);
        font-size: 11.5px;
        line-height: 1.4;
      }
    }
  }

  & .delivery {
    margin: 0;
    font-size: 12px;

    &.ok {
      color: #1d8a5c;
    }

    &.error {
      color: #c0164b;
    }
  }

  & .commands {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;

    & li {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 10px;
      background: var(--bg-subtle);
    }

    & .cmd {
      flex: none;
      padding: 3px 8px;
      background: rgba(91, 91, 240, 0.12);
      color: ${ACCENT};
      font-weight: 700;
    }

    & .desc {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
      font-size: 13px;

      & small {
        overflow: hidden;
        color: var(--text-muted);
        font-size: 11px;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
    }

    & .empty {
      color: var(--text-muted);
      font-size: 13px;
      background: transparent;
    }
  }

  & .command-form {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 8px;

    ${PHONE} {
      grid-template-columns: 1fr;
    }
  }

  & .prefixed {
    display: flex;
    align-items: center;
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    overflow: hidden;

    &:focus-within {
      border-color: #1264a3;
      box-shadow: 0 0 0 3px rgba(29, 155, 209, 0.3);
    }

    & span {
      padding: 0 2px 0 12px;
      color: ${ACCENT};
      font-weight: 800;
    }

    & input {
      flex: 1;
      min-width: 0;
      height: 38px;
      padding: 0 10px 0 2px;
      border: none;
      outline: none;
      background: transparent;
      color: var(--text);
      font-size: 15px;
    }
  }
`;

export const Steps = styled.ol`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;

  ${PHONE} {
    grid-template-columns: repeat(2, 1fr);
  }

  & li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--bg-subtle);
    font-size: 13px;

    & .dot {
      display: inline-flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--bg-hover);
      color: var(--text-muted);
      font-size: 11px;
      font-weight: 800;
    }

    &.done .dot {
      background: #2eb67d;
      color: #fff;
    }

    & button {
      padding: 0;
      border: none;
      background: none;
      color: ${ACCENT};
      font-weight: 700;
      text-decoration: underline;
    }
  }
`;

export const TokenBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border: 1px solid #f2c94c;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(242, 201, 76, 0.18), rgba(242, 153, 74, 0.1));

  & b {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
  }

  & small {
    color: var(--text-muted);
    font-size: 12px;
  }

  & code {
    padding: 10px 12px;
    border: 1px solid rgba(242, 153, 74, 0.4);
    border-radius: 8px;
    background: var(--bg);
    color: var(--text);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 13px;
    overflow-wrap: anywhere;
  }

  & div {
    display: flex;
    gap: 6px;
  }
`;

export const NewPane = styled.form`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  padding: 24px 28px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: radial-gradient(circle at top right, rgba(124, 92, 255, 0.12), transparent 55%), var(--bg);

  & .art {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    align-self: flex-start;
    width: 64px;
    height: 64px;
    border-radius: 18px;
    background: linear-gradient(135deg, #7c5cff, #3d8bfd);
    color: #fff;
    box-shadow: 0 10px 24px rgba(92, 92, 255, 0.35);
  }

  & h3 {
    margin: 4px 0 0;
    font-size: 20px;
  }

  & p {
    margin: 0;
    color: var(--text-muted);
    font-size: 13.5px;
    line-height: 1.6;
  }

  & .features {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0 0 6px;
    padding: 0;
    list-style: none;

    & li {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13.5px;

      & svg {
        color: ${ACCENT};
      }
    }
  }

  & button.primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 42px;
    border: none;
    border-radius: 10px;
    background: linear-gradient(135deg, #6c5cff, #3d8bfd);
    color: #fff;
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
    box-shadow: 0 6px 16px rgba(92, 92, 255, 0.3);

    &:disabled {
      opacity: 0.5;
      cursor: default;
      box-shadow: none;
    }
  }
`;

export const Code = styled.pre`
  margin: 0;
  padding: 12px 14px;
  border-radius: 10px;
  background: #1e1f2b;
  color: #e6e6f0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;
