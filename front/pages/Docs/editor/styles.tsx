import { css } from '@emotion/react';
import styled from '@emotion/styled';
import { MOBILE } from '@utils/media';

export const EditorWrap = styled.div`
  position: relative;
  padding: 0 20px 40px;

  & .editor-status {
    position: sticky;
    top: 8px;
    z-index: 5;
    width: fit-content;
    margin: 0 auto 8px;
    padding: 6px 14px;
    border-radius: 16px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    font-size: 13px;

    &.error {
      background: #e01e5a;
    }
  }

  & .editor-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;

    &.with-outline {
      grid-template-columns: minmax(0, 1fr) 200px;
    }
  }

  /* 문서 아래: 하위 페이지와 이 페이지를 링크한 문서 */
  & .subpages {
    max-width: 860px;
    margin: 32px 0 0 28px;
    padding-top: 12px;
    border-top: 1px solid var(--border);

    & h3 {
      margin: 12px 0 6px;
      font-size: 13px;
      color: var(--text-muted);
    }

    & ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    & li {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 3px 0;
      font-size: 14px;
    }

    & a {
      color: var(--text);
      text-decoration: none;
      border-bottom: 1px solid var(--border-strong);

      &:hover {
        background: var(--bg-hover);
      }
    }
  }

  & .outline {
    position: sticky;
    top: 12px;
    align-self: start;
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: calc(100vh - 160px);
    overflow-y: auto;
    padding-left: 12px;
    border-left: 1px solid var(--border);
    font-size: 13px;

    & strong {
      margin-bottom: 4px;
      color: var(--text-muted);
      font-size: 12px;
    }

    & button {
      padding: 3px 4px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: var(--text-muted);
      text-align: left;
      cursor: pointer;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;

      &:hover {
        background: var(--bg-hover);
        color: var(--text);
      }
    }
  }

  /* 편집 영역 (블록 왼쪽에 끌기 손잡이 자리를 둔다) */
  & .block-editor {
    max-width: 860px;
    min-height: 360px;
    padding: 8px 0 8px 28px;
    outline: none;
    font-size: 16px;
    line-height: 1.7;
    word-break: break-word;
    color: var(--text);

    & > * + * {
      margin-top: 0.4em;
    }

    & h1,
    & h2,
    & h3 {
      margin: 1.1em 0 0.3em;
      line-height: 1.3;
    }

    & h1 {
      font-size: 28px;
    }

    & h2 {
      font-size: 22px;
    }

    & h3 {
      font-size: 18px;
    }

    & p {
      margin: 0.3em 0;
    }

    & ul,
    & ol {
      padding-left: 24px;
    }

    & ul[data-type='taskList'] {
      list-style: none;
      padding-left: 2px;

      & li {
        display: flex;
        align-items: flex-start;
        gap: 8px;

        & > label {
          flex: none;
          margin-top: 4px;
          user-select: none;

          & input {
            width: 16px;
            height: 16px;
            cursor: pointer;
          }
        }

        & > div {
          flex: 1;
          min-width: 0;
        }

        &[data-checked='true'] > div {
          color: var(--text-faint);
          text-decoration: line-through;
        }
      }
    }

    & blockquote {
      margin: 0.6em 0;
      padding: 2px 14px;
      border-left: 4px solid var(--border-strong);
      color: var(--text-muted);
    }

    & pre {
      padding: 12px 14px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--bg-subtle);
      font-family: Monaco, Menlo, Consolas, monospace;
      font-size: 13px;
      overflow-x: auto;

      & code {
        padding: 0;
        background: none;
        color: inherit;
      }
    }

    & code {
      padding: 1px 4px;
      border-radius: 3px;
      background: var(--bg-hover);
      color: #c01343;
      font-family: Monaco, Menlo, Consolas, monospace;
      font-size: 0.88em;
    }

    & mark {
      padding: 0 2px;
      border-radius: 2px;
      background: #fff3a3;
      color: #1d1c1d;
    }

    & a {
      color: #1264a3;
      text-decoration: underline;
      cursor: pointer;
    }

    & hr {
      margin: 1.2em 0;
      border: none;
      border-top: 1px solid var(--border);

      &.ProseMirror-selectednode {
        border-top-color: #1264a3;
      }
    }

    & img {
      max-width: 100%;
      border-radius: 6px;

      &.ProseMirror-selectednode {
        outline: 3px solid #1d9bd1;
      }
    }

    & table {
      border-collapse: collapse;
      margin: 0.6em 0;
      table-layout: fixed;
      width: 100%;

      & td,
      & th {
        position: relative;
        padding: 6px 10px;
        border: 1px solid var(--border-strong);
        vertical-align: top;

        & > p {
          margin: 0;
        }
      }

      & th {
        background: var(--bg-subtle);
        font-weight: 700;
        text-align: left;
      }

      & .selectedCell::after {
        content: '';
        position: absolute;
        inset: 0;
        background: rgba(29, 155, 209, 0.15);
        pointer-events: none;
      }
    }

    /* 다른 문서로 가는 링크 */
    & .page-link {
      & a {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 0 3px;
        border-radius: 4px;
        border-bottom: 1px solid var(--border-strong);
        color: var(--text);
        font-weight: 500;
        text-decoration: none;
        vertical-align: baseline;

        &:hover {
          background: var(--bg-hover);
        }
      }

      &.selected a {
        outline: 2px solid #1d9bd1;
      }
    }

    & .page-link-missing {
      color: var(--text-faint);
      text-decoration: line-through;
    }

    /* 댓글이 달린 글 */
    & .comment-mark {
      background: rgba(255, 212, 0, 0.28);
      border-bottom: 2px solid rgba(232, 160, 29, 0.8);
      cursor: pointer;
    }

    /* 빈 줄 안내 글 */
    & .is-empty::before,
    & p.is-editor-empty:first-of-type::before {
      content: attr(data-placeholder);
      float: left;
      height: 0;
      color: var(--text-faint);
      pointer-events: none;
    }
  }

  /* 블록 끌기 손잡이 (tiptap-extension-global-drag-handle) */
  & .drag-handle {
    position: fixed;
    z-index: 4;
    width: 18px;
    height: 24px;
    border-radius: 4px;
    opacity: 1;
    transition: opacity 120ms ease-in;
    cursor: grab;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10' style='fill: rgba(127, 127, 127, 0.8)'%3E%3Cpath d='M3,2 C2.44771525,2 2,1.55228475 2,1 C2,0.44771525 2.44771525,0 3,0 C3.55228475,0 4,0.44771525 4,1 C4,1.55228475 3.55228475,2 3,2 Z M3,6 C2.44771525,6 2,5.55228475 2,5 C2,4.44771525 2.44771525,4 3,4 C3.55228475,4 4,4.44771525 4,5 C4,5.55228475 3.55228475,6 3,6 Z M3,10 C2.44771525,10 2,9.55228475 2,9 C2,8.44771525 2.44771525,8 3,8 C3.55228475,8 4,8.44771525 4,9 C4,9.55228475 3.55228475,10 3,10 Z M7,2 C6.44771525,2 6,1.55228475 6,1 C6,0.44771525 6.44771525,0 7,0 C7.55228475,0 8,0.44771525 8,1 C8,1.55228475 7.55228475,2 7,2 Z M7,6 C6.44771525,6 6,5.55228475 6,5 C6,4.44771525 6.44771525,4 7,4 C7.55228475,4 8,4.44771525 8,5 C8,5.55228475 7.55228475,6 7,6 Z M7,10 C6.44771525,10 6,9.55228475 6,9 C6,8.44771525 6.44771525,8 7,8 C7.55228475,8 8,8.44771525 8,9 C8,9.55228475 7.55228475,10 7,10 Z'%3E%3C/path%3E%3C/svg%3E");
    background-size: 10px 12px;
    background-position: center;
    background-repeat: no-repeat;

    &:hover {
      background-color: var(--bg-hover);
    }

    &.hide {
      opacity: 0;
      pointer-events: none;
    }
  }

  /* 다른 사람의 커서·이름표 */
  & .collab-cursor {
    position: relative;
    margin: 0 -1px;
    border-left: 2px solid;
    word-break: normal;
    pointer-events: none;
  }

  & .collab-cursor-label {
    position: absolute;
    top: -1.35em;
    left: -2px;
    padding: 0 5px;
    border-radius: 4px 4px 4px 0;
    color: white;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.5;
    white-space: nowrap;
    user-select: none;
  }

  /* 글자를 고르면 뜨는 서식 막대 */
  & .bubble-menu {
    display: flex;
    gap: 2px;
    padding: 4px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.15);

    & button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      height: 28px;
      padding: 0 6px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: var(--text);
      cursor: pointer;

      &:hover {
        background: var(--bg-hover);
      }

      &.on {
        background: var(--bg-selected);
        color: #1264a3;
      }
    }

    & .link-form {
      display: flex;
      gap: 4px;

      & input {
        width: 240px;
        height: 28px;
        padding: 0 8px;
        border: 1px solid var(--border-strong);
        border-radius: 4px;
        background: var(--bg);
        color: var(--text);
        font-size: 13px;
      }
    }
  }

  ${MOBILE} {
    padding: 0 8px 24px;

    & .editor-layout.with-outline {
      grid-template-columns: minmax(0, 1fr);
    }

    & .outline {
      display: none;
    }

    & .block-editor {
      padding-left: 4px;
    }
  }
`;

// '/' 블록 목록 (문서 본문 밖, body 에 붙는다)
export const slashMenuStyles = css`
  .slash-menu {
    width: 290px;

    & .menu-title {
      padding: 6px 8px 4px;
      font-size: 12px;
      color: var(--text-muted);
    }

    max-height: 340px;
    overflow-y: auto;
    padding: 4px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg);
    color: var(--text);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);

    & .empty {
      padding: 10px;
      font-size: 13px;
      color: var(--text-muted);
    }

    & button {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 6px 8px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: var(--text);
      text-align: left;
      cursor: pointer;

      &.on {
        background: var(--bg-hover);
      }

      & .icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: none;
        width: 34px;
        height: 34px;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--bg);
      }

      & .text {
        display: flex;
        flex-direction: column;
        min-width: 0;

        & b {
          font-size: 14px;
          font-weight: 600;
        }

        & small {
          font-size: 12px;
          color: var(--text-muted);
        }
      }
    }
  }
`;
