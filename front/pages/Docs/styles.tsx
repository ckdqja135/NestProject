import styled from '@emotion/styled';
import { MOBILE } from '@utils/media';

export const DocsLayout = styled.div`
  display: flex;
  height: calc(100vh - 38px);
  background: var(--bg);
  color: var(--text);
`;

export const Sidebar = styled.nav`
  flex: 0 0 260px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
  background: var(--bg-subtle);
  overflow-y: auto;

  ${MOBILE} {
    display: none;
  }

  & > .title {
    padding: 16px 16px 8px;
    font-size: 20px;
    font-weight: 800;
  }

  & > .search {
    margin: 0 12px 8px;

    & input {
      width: 100%;
      box-sizing: border-box;
      height: 32px;
      padding: 0 10px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--bg);
      color: var(--text);
      font-size: 14px;
      outline: none;
    }
  }

  & h4 {
    display: flex;
    align-items: center;
    margin: 14px 16px 4px;
    font-size: 12px;
    font-weight: 700;
    color: var(--text-muted);

    & button {
      margin-left: auto;
      border: none;
      background: transparent;
      color: var(--text-muted);
      font-size: 16px;
      cursor: pointer;
    }
  }

  & .item {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 1px 8px;
    padding: 6px 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text);
    font-size: 14px;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;

    &:hover {
      background: var(--bg-hover);
    }

    &.active {
      background: var(--bg-selected);
      color: #1264a3;
      font-weight: 700;
    }

    & > .label {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  & .empty {
    margin: 2px 18px;
    font-size: 12px;
    color: var(--text-faint);
  }

  & > .bottom {
    margin-top: auto;
    padding: 8px 0 12px;
    border-top: 1px solid var(--border);
  }
`;

export const Main = styled.main`
  flex: 1;
  min-width: 0;
  overflow-y: auto;
`;

export const HomeWrap = styled.div`
  max-width: 1200px;
  padding: 20px 28px;

  ${MOBILE} {
    padding: 12px;
  }

  & > h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 16px;
    font-size: 22px;
  }
`;

export const Cards = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 12px;
  margin-bottom: 20px;

  & > .card {
    position: relative;
  }

  & > .card > button {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    box-sizing: border-box;
    padding: 14px 16px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg);
    color: var(--text);
    text-align: left;
    cursor: pointer;

    &:hover {
      border-color: #1264a3;
    }

    & .icon {
      display: inline-flex;
    }

    & strong {
      display: block;
      font-size: 15px;
    }

    & small {
      color: var(--text-muted);
      font-size: 12px;
    }
  }
`;

export const DropMenu = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 10;
  min-width: 240px;
  padding: 4px 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.15);

  & > button {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 14px;
    border: none;
    background: transparent;
    color: var(--text);
    font-size: 14px;
    text-align: left;
    cursor: pointer;

    &:hover {
      background: var(--bg-hover);
    }

    & small {
      display: block;
      color: var(--text-muted);
      font-size: 12px;
    }
  }
`;

export const Tabs = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--border);

  /* 탭은 좁은 화면에서 가로로 넘기고, 보기 전환 버튼은 늘 오른쪽에 둔다 */
  & > .tablist {
    display: flex;
    flex: 1;
    min-width: 0;
    gap: 4px;
    overflow-x: auto;
  }

  & button.tab {
    flex: none;
    padding: 8px 12px;
    border: none;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: var(--text-muted);
    font-size: 15px;
    white-space: nowrap;
    cursor: pointer;

    ${MOBILE} {
      padding: 8px 8px;
      font-size: 14px;
    }

    &.active {
      border-bottom-color: #1264a3;
      color: #1264a3;
      font-weight: 700;
    }
  }

  & > .tools {
    flex: none;
    margin-left: auto;
    display: flex;
    gap: 4px;

    & button {
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg);
      color: var(--text);
      padding: 3px 8px;
      cursor: pointer;

      &.active {
        background: var(--bg-selected);
        border-color: #1264a3;
      }
    }
  }
`;

export const DocTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;

  & th {
    padding: 8px;
    border-bottom: 1px solid var(--border);
    color: var(--text-muted);
    font-weight: 600;
    text-align: left;
    white-space: nowrap;
  }

  & td {
    padding: 10px 8px;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
    max-width: 260px;
    overflow: hidden;
    text-overflow: ellipsis;

    /* 줄 메뉴(⋯)가 칸 밖으로 펼쳐진다 */
    &:last-of-type {
      overflow: visible;
      width: 1%;
    }
  }

  & tbody tr {
    cursor: pointer;

    &:hover {
      background: var(--bg-subtle);
    }
  }

  & .name {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
  }

  & .owner {
    display: flex;
    align-items: center;
    gap: 6px;

    & img {
      width: 20px;
      height: 20px;
      border-radius: 50%;
    }
  }

  & .muted {
    color: var(--text-muted);
  }

  & .where {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  ${MOBILE} {
    & .hide-mobile {
      display: none;
    }
  }
`;

export const RowMenuButton = styled.button`
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 16px;
  cursor: pointer;
  padding: 0 6px;
  border-radius: 4px;

  &:hover {
    background: var(--bg-hover);
  }
`;

export const DocGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;

  & > button {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg);
    color: var(--text);
    text-align: left;
    cursor: pointer;

    &:hover {
      border-color: #1264a3;
    }

    & .icon {
      display: inline-flex;
    }

    & strong {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    & small {
      color: var(--text-muted);
    }
  }
`;

export const Empty = styled.p`
  padding: 40px 0;
  text-align: center;
  color: var(--text-muted);
`;

// ── 문서 편집 화면
export const EditorHeader = styled.header`
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);

  ${MOBILE} {
    flex-wrap: wrap;
    padding: 8px 12px;
  }

  & .crumbs {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--text-muted);
    overflow: hidden;
    white-space: nowrap;

    & a {
      color: var(--text-muted);
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  & .status {
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;

    &.error {
      color: #e01e5a;
    }
  }

  & button.btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 30px;
    padding: 0 10px;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text);
    font-size: 13px;
    white-space: nowrap;
    cursor: pointer;

    &.primary {
      border-color: #1264a3;
      background: #1264a3;
      color: white;
    }

    &.on {
      background: var(--bg-selected);
      border-color: #1264a3;
    }

    /* 이 문서에서 허들이 진행 중 */
    &.live {
      border-color: #2eb67d;
      background: #2eb67d;
      color: white;
    }
  }

  & .modes {
    display: flex;

    & button {
      height: 30px;
      padding: 0 10px;
      border: 1px solid var(--border-strong);
      background: var(--bg);
      color: var(--text);
      font-size: 13px;
      cursor: pointer;

      &:first-of-type {
        border-radius: 6px 0 0 6px;
      }

      &:last-of-type {
        border-radius: 0 6px 6px 0;
      }

      & + button {
        border-left: none;
      }

      &.active {
        background: var(--bg-selected);
        color: #1264a3;
        font-weight: 700;
      }
    }
  }
`;

export const Banner = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 12px 20px 0;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--bg-pinned);
  font-size: 14px;

  & button {
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text);
    padding: 3px 10px;
    cursor: pointer;
  }
`;

export const TitleInput = styled.input`
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin: 0 0 8px;
  padding: 24px 32px 0;
  ${MOBILE} {
    padding: 16px 12px 0;
  }
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 30px;
  font-weight: 800;
  outline: none;

  &:read-only {
    cursor: default;
  }
`;

export const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);

  & button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 30px;
    height: 28px;
    padding: 0 6px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text);
    font-size: 13px;
    cursor: pointer;

    &:hover {
      background: var(--bg-hover);
    }
  }
`;

export const EditorBody = styled.div`
  display: flex;
  gap: 24px;
  padding: 0 32px 40px;

  ${MOBILE} {
    flex-direction: column;
    padding: 0 12px 24px;
  }

  & > .pane {
    flex: 1;
    min-width: 0;
  }

  /* 나란히 보기: 미리보기를 도구 모음 아래 글상자와 같은 높이에서 시작 */
  & > .pane + .pane {
    padding-top: 53px;

    ${MOBILE} {
      padding-top: 0;
    }
  }

  & textarea {
    width: 100%;
    min-height: 60vh;
    box-sizing: border-box;
    margin-top: 12px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
    color: var(--text);
    font-family: Monaco, Menlo, Consolas, monospace;
    font-size: 14px;
    line-height: 1.6;
    resize: vertical;
    outline: none;

    &:focus {
      border-color: #1264a3;
    }
  }
`;

// 마크다운 미리보기·보기 화면의 글 모양
export const DocBody = styled.article`
  max-width: 860px;
  padding-top: 8px;
  font-size: 15px;
  line-height: 1.7;
  word-break: break-word;

  & h1,
  & h2,
  & h3,
  & h4 {
    margin: 1.2em 0 0.4em;
    line-height: 1.3;
  }

  & h1 {
    font-size: 26px;
  }

  & h2 {
    font-size: 21px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--border);
  }

  & h3 {
    font-size: 18px;
  }

  & p {
    margin: 0.6em 0;
  }

  & ul,
  & ol {
    margin: 0.4em 0;
    padding-left: 24px;
  }

  & .doc-tasks {
    list-style: none;
    padding-left: 4px;

    & input {
      margin-right: 6px;
    }
  }

  & .doc-pre {
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-subtle);
    font-family: Monaco, Menlo, Consolas, monospace;
    font-size: 13px;
    overflow-x: auto;
  }

  & .md-code {
    padding: 1px 4px;
    border-radius: 3px;
    background: var(--bg-hover);
    color: #c01343;
    font-family: Monaco, Menlo, Consolas, monospace;
    font-size: 13px;
  }

  & .doc-quote {
    margin: 0.6em 0;
    padding: 2px 14px;
    border-left: 4px solid var(--border-strong);
    color: var(--text-muted);
  }

  & .doc-table-wrap {
    overflow-x: auto;
  }

  & .doc-table {
    border-collapse: collapse;
    margin: 0.6em 0;

    & th,
    & td {
      padding: 6px 12px;
      border: 1px solid var(--border);
    }

    & th {
      background: var(--bg-subtle);
    }
  }

  & .doc-figure {
    margin: 0.8em 0;

    & img {
      max-width: 100%;
      border-radius: 6px;
    }

    & figcaption {
      font-size: 13px;
      color: var(--text-muted);
    }
  }

  & hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 1.4em 0;
  }

  & a {
    color: #1264a3;
  }

  & .custom-emoji {
    width: 20px;
    height: 20px;
    vertical-align: middle;
  }

  & .md-mention-all {
    padding: 0 2px;
    border-radius: 3px;
    background: var(--bg-highlight);
    font-weight: 600;
  }
`;

// 발표 모드 (전체 화면)
export const Presenter = styled.div`
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #111;

  & > .stage {
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
    cursor: pointer;
  }

  & > .controls {
    position: fixed;
    bottom: 14px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    opacity: 0.35;
    transition: opacity 0.2s;

    &:hover {
      opacity: 1;
    }

    & .page {
      color: #ddd;
      font-size: 13px;
    }

    & button {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border: none;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.15);
      color: white;
      padding: 6px 10px;
      cursor: pointer;

      &:disabled {
        opacity: 0.4;
      }
    }
  }
`;

export const Outline = styled.aside`
  flex: 0 0 200px;
  position: sticky;
  top: 70px;
  align-self: flex-start;
  margin-top: 24px;
  font-size: 13px;

  ${MOBILE} {
    display: none;
  }

  & strong {
    display: block;
    margin-bottom: 6px;
    color: var(--text-muted);
  }

  & a {
    display: block;
    padding: 2px 0;
    color: var(--text-muted);
    text-decoration: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &:hover {
      color: #1264a3;
    }
  }
`;

export const ShareList = styled.ul`
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  max-height: 260px;
  overflow-y: auto;

  & li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;

    & img {
      width: 28px;
      height: 28px;
      border-radius: 6px;
    }

    & .who {
      flex: 1;
      min-width: 0;
      font-size: 14px;
      overflow: hidden;
      text-overflow: ellipsis;

      & small {
        display: block;
        color: var(--text-muted);
        font-size: 12px;
      }
    }

    & .role {
      font-size: 13px;
      color: var(--text-muted);
    }

    & button,
    & select {
      height: 28px;
      padding: 0 8px;
      border: 1px solid var(--border-strong);
      border-radius: 6px;
      background: var(--bg);
      color: var(--text);
      font-size: 13px;
      cursor: pointer;

      &.primary {
        border-color: #1264a3;
        background: #1264a3;
        color: white;
      }
    }
  }
`;

// 휴대폰 화면: 왼쪽 목록 대신 위쪽 메뉴
export const MobileNav = styled.nav`
  display: none;

  ${MOBILE} {
    display: flex;
    gap: 4px;
    padding: 8px 12px 0;
    overflow-x: auto;

    & a {
      flex: none;
      padding: 5px 10px;
      border: 1px solid var(--border);
      border-radius: 14px;
      color: var(--text);
      font-size: 13px;
      text-decoration: none;

      &.active {
        border-color: #1264a3;
        background: var(--bg-selected);
        color: #1264a3;
      }
    }
  }
`;

// 템플릿 고르기 창
export const Gallery = styled.div`
  & .search {
    position: relative;
    display: flex;
    align-items: center;
    margin-bottom: 14px;

    & svg {
      position: absolute;
      left: 12px;
      color: var(--text-faint);
      pointer-events: none;
    }

    & input {
      width: 100%;
      height: 40px;
      padding: 0 12px 0 36px;
      border: 1px solid var(--border-strong);
      border-radius: 8px;
      background: var(--bg);
      color: var(--text);
      font-size: 14px;
      outline: none;

      &:focus {
        border-color: #1264a3;
        box-shadow: 0 0 0 3px rgba(29, 155, 209, 0.2);
      }
    }
  }

  & .body {
    display: flex;
    gap: 16px;
    height: min(520px, 62vh);
  }

  & nav {
    flex: 0 0 160px;
    overflow-y: auto;

    & .nav-group {
      margin: 12px 8px 4px;
      font-size: 11px;
      font-weight: 700;
      color: var(--text-muted);
    }

    & button {
      display: flex;
      align-items: center;
      width: 100%;
      padding: 7px 10px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: var(--text);
      font-size: 13px;
      text-align: left;
      cursor: pointer;

      & small {
        margin-left: auto;
        color: var(--text-faint);
        font-size: 11px;
      }

      &:hover {
        background: var(--bg-hover);
      }

      &.on {
        background: var(--bg-selected);
        color: #1264a3;
        font-weight: 700;
      }
    }
  }

  & .grid {
    flex: 1;
    min-width: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    align-content: start;
    gap: 10px;
    overflow-y: auto;
    padding: 2px;

    & .empty {
      color: var(--text-muted);
      font-size: 13px;
    }
  }

  & .tpl {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg);
    color: var(--text);
    text-align: left;
    cursor: pointer;
    transition: border-color 120ms, box-shadow 120ms, transform 120ms;

    &:hover,
    &:focus-visible {
      border-color: #1264a3;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
      transform: translateY(-1px);
      outline: none;
    }

    & .icon {
      flex: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 9px;
      color: var(--tpl);
      background: color-mix(in srgb, var(--tpl) 13%, var(--bg));
    }

    & .text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;

      & b {
        font-size: 14px;
      }

      & small {
        font-size: 12px;
        color: var(--text-muted);
        line-height: 1.4;
      }

      & em {
        margin-top: 4px;
        font-size: 11px;
        font-style: normal;
        color: var(--text-faint);
      }
    }
  }

  ${MOBILE} {
    & .body {
      flex-direction: column;
      height: auto;
    }

    & nav {
      flex: none;
      display: flex;
      gap: 4px;
      overflow-x: auto;

      & .nav-group {
        display: none;
      }

      & button {
        width: auto;
        white-space: nowrap;

        & small {
          margin-left: 6px;
        }
      }
    }

    & .grid {
      max-height: 60vh;
    }
  }
`;

// 문서가 언급된 대화 목록 (문서 머리의 "대화" 단추)
export const MentionMenu = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  width: min(380px, 90vw);
  max-height: 420px;
  overflow-y: auto;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
  color: var(--text);
  text-align: left;

  & > strong {
    padding: 4px 6px 8px;
    font-size: 13px;
  }

  & > .empty {
    margin: 4px 6px 8px;
    color: var(--text-muted);
    font-size: 13px;
    line-height: 1.5;
  }

  & > button {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;

    &:hover {
      background: var(--bg-hover);
    }

    & .meta {
      color: var(--text-muted);
      font-size: 12px;
    }

    & .text {
      display: -webkit-box;
      overflow: hidden;
      font-size: 13px;
      line-height: 1.45;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      word-break: break-word;
    }
  }
`;
