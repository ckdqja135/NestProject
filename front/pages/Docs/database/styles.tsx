import styled from '@emotion/styled';
import { MOBILE } from '@utils/media';

export const DatabaseWrap = styled.div`
  position: relative;
  margin: 0 20px 24px;
  color: var(--text);

  /* 선택지 색 (라이트·다크 모두 읽히게 반투명) */
  --opt-gray: rgba(140, 140, 140, 0.22);
  --opt-brown: rgba(150, 100, 60, 0.22);
  --opt-orange: rgba(232, 137, 29, 0.25);
  --opt-yellow: rgba(230, 190, 30, 0.3);
  --opt-green: rgba(18, 160, 107, 0.22);
  --opt-blue: rgba(47, 128, 237, 0.22);
  --opt-purple: rgba(124, 92, 214, 0.22);
  --opt-pink: rgba(214, 74, 155, 0.22);
  --opt-red: rgba(224, 64, 90, 0.22);

  & .db-status {
    padding: 40px 0;
    text-align: center;
    color: var(--text-muted);
    font-size: 14px;

    &.floating {
      position: sticky;
      top: 8px;
      z-index: 6;
      width: fit-content;
      margin: 0 auto 8px;
      padding: 6px 14px;
      border-radius: 16px;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      font-size: 13px;
    }
  }

  & .pill {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    padding: 1px 8px;
    border-radius: 4px;
    font-size: 13px;
    line-height: 1.6;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  & .pills {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  & .person {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;

    & img {
      width: 18px;
      height: 18px;
      border-radius: 50%;
    }
  }

  & .checked {
    color: #2eb67d;
  }

  & a {
    color: #1264a3;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  /* 위쪽 막대: 보기 탭과 도구 */
  & .db-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    padding-bottom: 8px;
    margin-bottom: 8px;
    border-bottom: 1px solid var(--border);

    & button {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      height: 30px;
      padding: 0 10px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: var(--text-muted);
      font-size: 13px;
      cursor: pointer;
      white-space: nowrap;

      &:hover:not(:disabled) {
        background: var(--bg-hover);
        color: var(--text);
      }

      &.on {
        color: var(--text);
        background: var(--bg-hover);
        font-weight: 700;
      }

      &.primary {
        background: #1264a3;
        color: white;
        font-weight: 700;

        &:hover {
          background: #0f5689;
          color: white;
        }
      }

      &.chip {
        border: 1px solid var(--border);
      }
    }
  }

  & .tabs {
    display: flex;
    align-items: center;
    gap: 2px;
    overflow-x: auto;
  }

  & .tools {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
  }

  & .search {
    position: relative;
    display: flex;
    align-items: center;

    & svg {
      position: absolute;
      left: 8px;
      color: var(--text-faint);
      pointer-events: none;
    }

    & input {
      width: 140px;
      height: 30px;
      padding: 0 8px 0 26px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg);
      color: var(--text);
      font-size: 13px;
      outline: none;

      &:focus {
        border-color: #1264a3;
      }
    }
  }

  & .menu-anchor {
    position: relative;
  }

  & .menu,
  & .prop-menu,
  & .picker {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 30;
    min-width: 200px;
    padding: 6px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
    font-weight: normal;
    text-align: left;

    &.right {
      left: auto;
      right: 0;
    }

    & input,
    & select {
      width: 100%;
      height: 30px;
      margin-bottom: 4px;
      padding: 0 8px;
      border: 1px solid var(--border-strong);
      border-radius: 6px;
      background: var(--bg);
      color: var(--text);
      font-size: 13px;
    }

    & button {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      height: auto;
      padding: 6px 8px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: var(--text);
      font-size: 13px;
      text-align: left;
      cursor: pointer;

      &:hover {
        background: var(--bg-hover);
      }

      &.danger {
        color: #e01e5a;
      }
    }

    & .row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--text-muted);

      & select {
        margin: 0;
      }
    }

    & hr {
      margin: 4px 0;
      border: none;
      border-top: 1px solid var(--border);
    }
  }

  & .picker {
    width: 240px;

    & .items {
      max-height: 220px;
      overflow-y: auto;
    }

    & .items button.on {
      background: var(--bg-selected);
    }

    & .mark {
      margin-left: auto;
      color: #1264a3;
    }

    & .none {
      margin: 6px 8px;
      font-size: 12px;
      color: var(--text-muted);
    }

    & .clear {
      margin-top: 4px;
      border-top: 1px solid var(--border);
      border-radius: 0;
      color: var(--text-muted);
    }
  }

  & .cell-input {
    width: 100%;
    height: 30px;
    padding: 0 6px;
    border: 2px solid #1264a3;
    border-radius: 4px;
    background: var(--bg);
    color: var(--text);
    font-size: 14px;
    outline: none;
  }

  & .empty {
    padding: 24px 0;
    color: var(--text-muted);
    font-size: 14px;
  }

  /* 표 */
  & .table-wrap {
    overflow-x: auto;
  }

  & .db-table {
    border-collapse: collapse;
    min-width: 100%;
    font-size: 14px;

    & th,
    & td {
      position: relative;
      min-width: 140px;
      max-width: 320px;
      height: 36px;
      padding: 4px 8px;
      border: 1px solid var(--border);
      text-align: left;
      vertical-align: middle;
    }

    & th {
      padding: 0;
      background: var(--bg-subtle);
      font-weight: 600;
      color: var(--text-muted);

      &.add-col {
        min-width: 36px;
        width: 36px;
      }

      & .th {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
        height: 36px;
        padding: 0 8px;
        border: none;
        background: transparent;
        color: inherit;
        font: inherit;
        cursor: pointer;

        &:hover {
          background: var(--bg-hover);
        }
      }
    }

    & .title-col {
      min-width: 220px;
      font-weight: 600;
    }

    & td {
      cursor: default;

      &.editing {
        padding: 2px;
      }

      & .untitled {
        color: var(--text-faint);
        font-weight: normal;
      }

      & .open-row {
        position: absolute;
        top: 50%;
        right: 6px;
        display: none;
        align-items: center;
        gap: 3px;
        padding: 2px 6px;
        border: 1px solid var(--border);
        border-radius: 4px;
        background: var(--bg);
        color: var(--text-muted);
        font-size: 11px;
        font-weight: normal;
        transform: translateY(-50%);
        cursor: pointer;
      }

      & .num {
        display: block;
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
    }

    & tr:hover td {
      background: var(--bg-subtle);

      & .open-row {
        display: inline-flex;
      }
    }

    & .prop-menu,
    & .picker {
      top: 100%;
    }
  }

  & .add-row {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 8px;
    border: none;
    border-bottom: 1px solid var(--border);
    background: transparent;
    color: var(--text-muted);
    font-size: 13px;
    text-align: left;
    cursor: pointer;

    &:hover {
      background: var(--bg-hover);
    }
  }

  /* 카드 (보드·갤러리 공통) */
  & .card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
    font-size: 14px;
    cursor: pointer;
    text-align: left;
    color: var(--text);

    &:hover {
      background: var(--bg-subtle);
    }

    &.dragging {
      opacity: 0.4;
    }

    & .card-props {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 13px;
    }
  }

  & .board-view {
    & .group-by {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 8px;
      font-size: 12px;
      color: var(--text-muted);

      & select {
        height: 28px;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--bg);
        color: var(--text);
      }
    }

    & .columns {
      display: flex;
      gap: 12px;
      overflow-x: auto;
      padding-bottom: 8px;
    }

    & .column {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 0 0 260px;
      min-height: 120px;
      padding: 8px;
      border-radius: 10px;
      background: var(--bg-subtle);

      &.over {
        outline: 2px dashed #1d9bd1;
      }

      & header {
        display: flex;
        align-items: center;
        gap: 6px;

        & small {
          color: var(--text-faint);
        }
      }
    }

    & .add-card {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: var(--text-muted);
      font-size: 13px;
      cursor: pointer;

      &:hover {
        background: var(--bg-hover);
      }
    }
  }

  & .gallery-view {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;

    & .card {
      min-height: 120px;
    }

    & .add-card {
      align-items: center;
      justify-content: center;
      flex-direction: row;
      border-style: dashed;
      color: var(--text-muted);
      background: transparent;
    }
  }

  /* 캘린더 */
  & .calendar-view {
    & .cal-bar {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 8px;

      & button {
        display: inline-flex;
        align-items: center;
        height: 28px;
        padding: 0 8px;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--bg);
        color: var(--text);
        cursor: pointer;
      }

      & strong {
        min-width: 110px;
        text-align: center;
      }

      & select {
        height: 28px;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--bg);
        color: var(--text);
      }

      & .nodate {
        margin-left: auto;
        color: var(--text-muted);
      }
    }

    & .cal-grid {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      border-top: 1px solid var(--border);
      border-left: 1px solid var(--border);

      & .wd {
        padding: 4px 6px;
        border-right: 1px solid var(--border);
        border-bottom: 1px solid var(--border);
        background: var(--bg-subtle);
        font-size: 12px;
        color: var(--text-muted);
        text-align: center;
      }

      & .day {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-height: 104px;
        padding: 4px;
        border-right: 1px solid var(--border);
        border-bottom: 1px solid var(--border);

        &.other {
          background: var(--bg-subtle);

          & .num {
            color: var(--text-faint);
          }
        }

        &.today .num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #e0405a;
          color: white;
        }

        & .num {
          font-size: 12px;
        }

        & .event {
          padding: 2px 6px;
          border: 1px solid var(--border);
          border-radius: 4px;
          background: var(--bg);
          color: var(--text);
          font-size: 12px;
          text-align: left;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          cursor: pointer;
        }

        & .add-day {
          position: absolute;
          top: 3px;
          right: 3px;
          display: none;
          padding: 2px;
          border: none;
          border-radius: 4px;
          background: var(--bg-hover);
          color: var(--text-muted);
          cursor: pointer;
        }

        &:hover .add-day {
          display: inline-flex;
        }
      }
    }
  }

  /* 항목 창 */
  & .row-panel {
    position: fixed;
    top: 38px;
    right: 0;
    bottom: 0;
    z-index: 40;
    width: min(460px, 100%);
    padding: 12px 24px 24px;
    overflow-y: auto;
    border-left: 1px solid var(--border);
    background: var(--bg);
    box-shadow: -8px 0 24px rgba(0, 0, 0, 0.12);

    & .panel-top {
      display: flex;
      justify-content: flex-end;

      & button {
        display: inline-flex;
        padding: 4px;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: var(--text-muted);
        cursor: pointer;

        &:hover {
          background: var(--bg-hover);
        }
      }
    }

    & .row-title {
      width: 100%;
      margin: 8px 0 16px;
      border: none;
      background: transparent;
      color: var(--text);
      font-size: 26px;
      font-weight: 800;
      outline: none;
    }

    & .row-props {
      margin: 0;

      & .prop {
        display: grid;
        grid-template-columns: 130px minmax(0, 1fr);
        align-items: center;
        gap: 8px;
        min-height: 36px;
      }

      & dt {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: var(--text-muted);
      }

      & dd {
        position: relative;
        margin: 0;
        padding: 4px 6px;
        border-radius: 4px;
        font-size: 14px;

        &.editable {
          cursor: pointer;

          &:hover {
            background: var(--bg-hover);
          }
        }

        & .placeholder {
          color: var(--text-faint);
        }
      }
    }

    & .meta {
      margin-top: 16px;
      font-size: 12px;
      color: var(--text-faint);
    }

    & .delete-row {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
      padding: 6px 10px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: #e01e5a;
      cursor: pointer;

      &:hover {
        background: var(--bg-danger);
      }
    }

    & .confirm {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
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

  ${MOBILE} {
    margin: 0 8px 16px;

    & .tools {
      margin-left: 0;
      flex-wrap: wrap;
    }

    & .search input {
      width: 110px;
    }

    & .calendar-view .cal-grid .day {
      min-height: 64px;
    }
  }
`;
