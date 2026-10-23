import styled from '@emotion/styled';
import { MOBILE } from '@utils/media';

export const ContactsLayout = styled.div`
  display: flex;
  height: calc(100vh - 38px);
  background: var(--bg);
  color: var(--text);
  overflow: hidden;

  /* 아바타 공통: 사진 또는 이름 첫 글자 동그라미, 오른쪽 아래 접속 표시 */
  & .avatar-wrap {
    position: relative;
    flex: none;
    display: inline-flex;
  }

  & .avatar {
    border-radius: 50%;
    object-fit: cover;
  }

  & .avatar.initial {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 700;
  }

  & .presence {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 11px;
    height: 11px;
    border: 2px solid var(--bg);
    border-radius: 50%;

    &.on {
      background: #2eb67d;
    }

    &.away {
      background: var(--bg);
      box-shadow: inset 0 0 0 2px #2eb67d;
    }

    &.off {
      background: var(--bg);
      box-shadow: inset 0 0 0 2px var(--text-faint);
    }
  }

  ${MOBILE} {
    flex-direction: column;
    height: auto;
    min-height: calc(100vh - 38px);
    overflow: visible;
  }
`;

export const Side = styled.aside`
  flex: 0 0 260px;
  padding: 18px 12px;
  border-right: 1px solid var(--border);
  background: var(--bg-subtle);
  overflow-y: auto;

  & h1 {
    margin: 0 8px 18px;
    font-size: 22px;
    font-weight: 800;
  }

  & .ws {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 8px 12px;
    font-size: 15px;
    font-weight: 700;

    & .ws-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: #4a154b;
      color: white;
      font-size: 14px;
      font-weight: 800;
    }

    & .ws-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  & nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  & nav button {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 11px 12px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text);
    font-size: 15px;
    text-align: left;
    cursor: pointer;

    &:hover {
      background: var(--bg-hover);
    }

    &.on {
      background: var(--bg-selected);
      color: #1264a3;
      font-weight: 700;
    }
  }

  ${MOBILE} {
    flex: none;
    padding: 12px 8px 8px;
    border-right: none;
    border-bottom: 1px solid var(--border);

    & h1,
    & .ws {
      display: none;
    }

    & nav {
      flex-direction: row;
      overflow-x: auto;
    }

    & nav button {
      flex: none;
      width: auto;
      padding: 8px 10px;
      font-size: 13px;
      gap: 6px;
      white-space: nowrap;
    }
  }
`;

export const Main = styled.main`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;

  & > header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 24px;
    border-bottom: 1px solid var(--border);

    & h2 {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin: 0;
      font-size: 18px;
      white-space: nowrap;

      & small {
        font-size: 13px;
        font-weight: normal;
        color: var(--text-muted);
      }
    }

    & .search {
      position: relative;
      display: flex;
      align-items: center;
      flex: 1;
      max-width: 360px;
      margin-left: auto;

      & svg {
        position: absolute;
        left: 10px;
        color: var(--text-faint);
        pointer-events: none;
      }

      & input {
        width: 100%;
        height: 34px;
        padding: 0 10px 0 32px;
        border: 1px solid var(--border-strong);
        border-radius: 8px;
        background: var(--bg);
        color: var(--text);
        font-size: 13px;
        outline: none;

        &:focus {
          border-color: #1264a3;
          box-shadow: 0 0 0 3px rgba(29, 155, 209, 0.2);
        }
      }
    }

    & .add {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 34px;
      padding: 0 14px;
      border: 1px solid #1264a3;
      border-radius: 8px;
      background: var(--bg);
      color: #1264a3;
      font-size: 13px;
      font-weight: 700;
      white-space: nowrap;
      cursor: pointer;

      &:hover {
        background: var(--bg-selected);
      }
    }
  }

  & .content {
    flex: 1;
    min-height: 0;
    display: flex;
  }

  ${MOBILE} {
    & > header {
      flex-wrap: wrap;
      padding: 12px 16px;

      & .search {
        order: 3;
        flex-basis: 100%;
        max-width: none;
        margin-left: 0;
      }

      & .add {
        margin-left: auto;
      }
    }

    & .content {
      display: block;
    }
  }
`;

export const List = styled.div`
  flex: 1;
  min-width: 0;
  padding: 8px 24px 24px;
  overflow-y: auto;

  & section {
    margin-top: 16px;
  }

  & h3 {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0 0 6px;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-muted);

    & small {
      font-size: 12px;
      font-weight: normal;
    }

    & .desc {
      flex-basis: 100%;
      font-size: 12px;
      font-weight: normal;
      color: var(--text-faint);
    }
  }

  & ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  & li {
    position: relative;
    display: flex;
    align-items: center;
    border-radius: 10px;

    &:hover,
    &.active {
      background: var(--bg-hover);
    }

    &.active {
      box-shadow: inset 3px 0 0 #1264a3;
    }
  }

  & .person {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 10px;
    border: none;
    background: transparent;
    color: var(--text);
    font-size: 16px;
    text-align: left;
    cursor: pointer;

    & .avatar {
      width: 40px;
      height: 40px;
    }

    & .name {
      flex: none;
      max-width: 50%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;

      & .me {
        font-size: 13px;
        color: var(--text-muted);
      }

      & .role-tag {
        margin-left: 6px;
        padding: 1px 5px;
        border-radius: 4px;
        background: rgba(232, 137, 29, 0.15);
        color: #b8640b;
        font-size: 11px;
        font-weight: 700;
      }
    }

    & .meta {
      min-width: 0;
      padding-left: 10px;
      border-left: 1px solid var(--border-strong);
      font-size: 14px;
      color: var(--text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    & .status {
      flex: none;
      font-size: 14px;
    }
  }

  & .star {
    flex: none;
    display: inline-flex;
    margin-right: 10px;
    padding: 6px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-faint);
    cursor: pointer;
    visibility: hidden;

    &:hover {
      background: var(--bg-selected);
    }

    &.on {
      color: #e8a01d;
      visibility: visible;
    }
  }

  & li:hover .star,
  & .star:focus-visible {
    visibility: visible;
  }

  & .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    margin: 80px auto 0;
    max-width: 360px;
    text-align: center;
    color: var(--text-muted);
    font-size: 14px;

    & svg {
      color: var(--text-faint);
    }

    & .primary {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 36px;
      padding: 0 16px;
      border: none;
      border-radius: 8px;
      background: #1264a3;
      color: white;
      font-weight: 700;
      cursor: pointer;
    }
  }

  & .no-result {
    margin: 40px 0;
    text-align: center;
    color: var(--text-muted);
    font-size: 14px;
  }

  ${MOBILE} {
    padding: 4px 8px 16px;

    & .person {
      flex-wrap: wrap;
      row-gap: 0;
      font-size: 15px;

      & .meta {
        flex-basis: calc(100% - 54px);
        margin-left: 54px;
        margin-top: -14px;
        padding-left: 0;
        border-left: none;
        font-size: 12px;
      }
    }

    & .star {
      visibility: visible;
    }
  }
`;

export const Detail = styled.aside`
  position: relative;
  flex: 0 0 340px;
  padding: 28px 24px;
  border-left: 1px solid var(--border);
  overflow-y: auto;

  & .close {
    position: absolute;
    top: 12px;
    right: 12px;
    display: inline-flex;
    padding: 6px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;

    &:hover {
      background: var(--bg-hover);
    }
  }

  & .head {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;

    & .avatar {
      width: 72px;
      height: 72px;
    }

    & .presence {
      width: 16px;
      height: 16px;
      border-width: 3px;
    }

    & h2 .role-tag {
      margin-left: 6px;
      padding: 1px 6px;
      border-radius: 4px;
      background: rgba(18, 100, 163, 0.12);
      color: #1264a3;
      font-size: 12px;
      font-weight: 700;
      vertical-align: middle;

      &.guest {
        background: rgba(232, 137, 29, 0.15);
        color: #b8640b;
      }
    }

    & h2 {
      margin: 12px 0 4px;
      font-size: 20px;

      & small {
        font-size: 14px;
        font-weight: normal;
        color: var(--text-muted);
      }
    }

    & .meta {
      margin: 0 0 4px;
      font-size: 14px;
      color: var(--text-muted);
    }

    & .presence-text {
      margin: 0;
      font-size: 13px;
      color: var(--text-faint);
    }
  }

  & .actions {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 8px;
    margin: 20px 0;
  }

  & .action {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-width: 62px;
    padding: 8px 6px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg);
    color: var(--text);
    font-size: 12px;
    text-decoration: none;
    cursor: pointer;

    &:hover {
      background: var(--bg-hover);
    }

    &.primary {
      border-color: #1264a3;
      background: #1264a3;
      color: white;

      &:hover {
        background: #0f5689;
      }
    }

    &.on {
      color: #e8a01d;
      border-color: #e8a01d;
    }
  }

  & .info {
    margin: 0;
    border-top: 1px solid var(--border);

    & .row {
      display: grid;
      grid-template-columns: 60px 1fr;
      gap: 8px;
      padding: 10px 0;
      border-bottom: 1px solid var(--border);
      font-size: 14px;
    }

    & dt {
      color: var(--text-muted);
    }

    & dd {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0;
      min-width: 0;
      word-break: break-all;

      & a {
        color: #1264a3;
        text-decoration: none;

        &:hover {
          text-decoration: underline;
        }
      }

      &.memo {
        white-space: pre-wrap;
        word-break: break-word;
      }
    }

    & .copy {
      display: inline-flex;
      padding: 3px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: var(--text-faint);
      cursor: pointer;

      &:hover {
        color: var(--text);
        background: var(--bg-hover);
      }
    }

    & .chip {
      padding: 2px 8px;
      border-radius: 10px;
      background: var(--bg-selected);
      color: #1264a3;
      font-size: 12px;
    }
  }

  & .more {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 16px;

    & > button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 10px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: #1264a3;
      font-size: 13px;
      text-align: left;
      cursor: pointer;

      &:hover {
        background: var(--bg-hover);
      }

      &.danger-text {
        color: #e01e5a;
      }
    }

    & .confirm {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 10px;
      border-radius: 8px;
      background: var(--bg-danger);
      font-size: 13px;

      & span {
        flex: 1;
      }

      & button {
        padding: 4px 10px;
        border: 1px solid var(--border-strong);
        border-radius: 6px;
        background: var(--bg);
        color: var(--text);
        cursor: pointer;

        &.danger {
          border-color: #e01e5a;
          background: #e01e5a;
          color: white;
        }
      }
    }
  }

  /* 휴대폰: 목록 위에 덮는 화면 */
  ${MOBILE} {
    position: fixed;
    inset: 38px 0 0 0;
    z-index: 40;
    border-left: none;
    background: var(--bg);
  }
`;

export const TwoColumns = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 12px;

  ${MOBILE} {
    grid-template-columns: 1fr;
  }
`;

export const MemoInput = styled.textarea`
  width: 100%;
  box-sizing: border-box;
  padding: 8px 12px;
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text);
  font: inherit;
  font-size: 15px;
  resize: vertical;
  outline: none;

  &:focus {
    border-color: #1264a3;
    box-shadow: 0 0 0 3px rgba(29, 155, 209, 0.3);
  }
`;
