import styled from '@emotion/styled';
import { MOBILE } from '@utils/media';
import { ROW_HEIGHT } from './model';

export const SheetWrap = styled.div`
  display: flex;
  flex-direction: column;
  height: calc(100vh - 38px - 140px);
  min-height: 360px;
  margin: 0 20px 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg);

  ${MOBILE} {
    margin: 0 8px 8px;
  }
`;

export const SheetToolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-subtle);

  & .sep {
    width: 1px;
    height: 20px;
    margin: 0 4px;
    background: var(--border);
  }

  & button,
  & label.tool {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-width: 28px;
    height: 28px;
    padding: 0 6px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text);
    font-size: 12px;
    cursor: pointer;

    &:hover:not(:disabled) {
      background: var(--bg-hover);
    }

    &:disabled {
      opacity: 0.4;
      cursor: default;
    }

    &.on {
      background: var(--bg-selected);
      color: #1264a3;
    }
  }

  & label.tool {
    position: relative;

    & input[type='color'] {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
    }

    & .swatch {
      position: absolute;
      left: 6px;
      right: 6px;
      bottom: 3px;
      height: 3px;
      border-radius: 1px;
    }
  }

  & select {
    height: 26px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg);
    color: var(--text);
    font-size: 12px;
  }
`;

export const FormulaBar = styled.div`
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--border);

  & .name {
    flex: 0 0 90px;
    padding: 0 8px;
    border-right: 1px solid var(--border);
    font-size: 12px;
    font-family: Monaco, Menlo, Consolas, monospace;
    color: var(--text-muted);
    line-height: 28px;
    overflow: hidden;
    white-space: nowrap;
  }

  & .fx {
    padding: 0 8px;
    color: var(--text-muted);
    font-style: italic;
    font-size: 13px;
  }

  & input {
    flex: 1;
    min-width: 0;
    height: 28px;
    border: none;
    background: transparent;
    color: var(--text);
    font-size: 13px;
    font-family: Monaco, Menlo, Consolas, monospace;
    outline: none;
  }
`;

export const Grid = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: auto;
  outline: none;
  user-select: none;

  & table {
    border-collapse: separate;
    border-spacing: 0;
    table-layout: fixed;
    font-size: 13px;
  }

  & th,
  & td {
    height: ${ROW_HEIGHT}px;
    box-sizing: border-box;
    padding: 0 4px;
    border-right: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  & thead th {
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--bg-subtle);
    color: var(--text-muted);
    font-weight: 500;
    font-size: 12px;
    text-align: center;
    cursor: pointer;

    &.active {
      background: var(--bg-selected);
      color: #1264a3;
      font-weight: 700;
    }

    & .resize {
      position: absolute;
      top: 0;
      right: -3px;
      width: 6px;
      height: 100%;
      cursor: col-resize;
      z-index: 3;
    }
  }

  & thead th.corner {
    left: 0;
    z-index: 3;
  }

  & tbody th {
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--bg-subtle);
    color: var(--text-muted);
    font-weight: 500;
    font-size: 12px;
    text-align: center;
    cursor: pointer;

    &.active {
      background: var(--bg-selected);
      color: #1264a3;
      font-weight: 700;
    }
  }

  & td {
    position: relative;
    cursor: cell;

    &.num {
      text-align: right;
    }

    &.err {
      color: #e0405a;
    }

    &.in {
      background-color: rgba(18, 100, 163, 0.1) !important;
    }

    &.cursor {
      box-shadow: inset 0 0 0 2px #1264a3;
    }

    & input {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      padding: 0 4px;
      border: 2px solid #1264a3;
      background: var(--bg);
      color: var(--text);
      font: inherit;
      outline: none;
      z-index: 2;
    }
  }
`;

export const StatusBar = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  border-top: 1px solid var(--border);
  background: var(--bg-subtle);
  font-size: 12px;

  & .tabs {
    display: flex;
    flex: 1;
    min-width: 0;
    overflow-x: auto;
  }

  & .tab {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 28px;
    padding: 0 12px;
    border: none;
    border-right: 1px solid var(--border);
    background: transparent;
    color: var(--text-muted);
    font-size: 12px;
    white-space: nowrap;
    cursor: pointer;

    &.active {
      background: var(--bg);
      color: #1264a3;
      font-weight: 700;
    }

    & input {
      width: 80px;
      font-size: 12px;
    }

    & .x {
      display: inline-flex;
      color: var(--text-faint);
    }
  }

  & .add {
    display: inline-flex;
    align-items: center;
    height: 28px;
    padding: 0 8px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
  }

  & .stats {
    padding: 0 10px;
    color: var(--text-muted);
    white-space: nowrap;
  }
`;
