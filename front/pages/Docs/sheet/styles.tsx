import styled from '@emotion/styled';
import { MOBILE } from '@utils/media';

export const HEADER_W = 46;
export const HEADER_H = 24;

export const SheetWrap = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 38px - 140px);
  min-height: 380px;
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
  gap: 1px;
  padding: 4px 6px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-subtle);

  & .sep {
    width: 1px;
    height: 20px;
    margin: 0 4px;
    background: var(--border);
  }

  & .group {
    position: relative;
  }

  & button,
  & label.tool {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-width: 28px;
    height: 28px;
    padding: 0 5px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text);
    font-size: 12px;
    white-space: nowrap;
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

    & input[type='color'],
    & input[type='file'] {
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
      border: 1px solid var(--border);
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

export const PopMenu = styled.div`
  position: absolute;
  z-index: 40;
  min-width: 180px;
  max-height: 70vh;
  overflow-y: auto;
  padding: 4px 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
  font-size: 13px;

  & > button {
    display: flex !important;
    align-items: center;
    justify-content: flex-start !important;
    gap: 8px !important;
    width: 100%;
    height: auto !important;
    padding: 6px 12px !important;
    border: none;
    border-radius: 0 !important;
    background: transparent;
    color: var(--text);
    font-size: 13px !important;
    text-align: left;
    cursor: pointer;

    &:hover {
      background: var(--bg-hover);
    }

    & .key {
      margin-left: auto;
      color: var(--text-faint);
      font-size: 11px;
    }
  }

  & hr {
    margin: 4px 0;
    border: none;
    border-top: 1px solid var(--border);
  }

  & .title {
    padding: 4px 12px;
    color: var(--text-muted);
    font-size: 11px;
  }
`;

export const FormulaBar = styled.div`
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--border);

  & .name {
    flex: 0 0 90px;
    height: 28px;
    padding: 0 8px;
    border: none;
    border-right: 1px solid var(--border);
    background: transparent;
    color: var(--text-muted);
    font-size: 12px;
    font-family: Monaco, Menlo, Consolas, monospace;
    outline: none;
  }

  & .fx {
    padding: 0 8px;
    color: var(--text-muted);
    font-style: italic;
    font-size: 13px;
  }

  & input.formula {
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

export const FindBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-pinned);
  font-size: 12px;

  & input[type='text'] {
    width: 160px;
    height: 26px;
    padding: 0 6px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg);
    color: var(--text);
  }

  & button {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    height: 26px;
    padding: 0 8px;
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    background: var(--bg);
    color: var(--text);
    cursor: pointer;
  }

  & .count {
    color: var(--text-muted);
  }
`;

export const Viewport = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  outline: none;
  user-select: none;
  font-size: 13px;

  & .scroller {
    position: absolute;
    inset: 0;
    overflow: auto;
  }

  & .pane {
    position: absolute;
    overflow: hidden;
    background: var(--bg);
  }

  & .pane.frozen-r {
    border-bottom: 2px solid #b8c4d0;
  }

  & .pane.frozen-c {
    border-right: 2px solid #b8c4d0;
  }

  & .cell {
    position: absolute;
    box-sizing: border-box;
    display: flex;
    align-items: flex-end;
    padding: 2px 4px;
    border-right: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    background: var(--bg);
    white-space: nowrap;
    overflow: hidden;
    cursor: cell;

    & > .text {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    &.wrap {
      white-space: pre-wrap;
      word-break: break-word;
    }

    &.num > .text {
      text-align: right;
    }

    &.err {
      color: #e0405a;
    }

    &.in::after {
      content: '';
      position: absolute;
      inset: 0;
      background: rgba(18, 100, 163, 0.12);
      pointer-events: none;
    }

    &.cursor {
      box-shadow: inset 0 0 0 2px #1264a3;
      z-index: 2;
      overflow: visible;
    }

    &.has-handle {
      overflow: visible;
      z-index: 3;
    }

    &.found {
      box-shadow: inset 0 0 0 2px #f2c94c;
    }

    &.fill-target::after {
      content: '';
      position: absolute;
      inset: 0;
      border: 1px dashed #1264a3;
      pointer-events: none;
    }

    & .note {
      position: absolute;
      top: 0;
      right: 0;
      width: 0;
      height: 0;
      border-top: 7px solid #e0405a;
      border-left: 7px solid transparent;
    }

    & .drop {
      flex: none;
      display: inline-flex;
      margin-left: 2px;
      color: var(--text-muted);
    }

    & .filter-btn {
      flex: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      margin-left: 2px;
      border: 1px solid var(--border-strong);
      border-radius: 3px;
      background: var(--bg);
      color: var(--text-muted);
      cursor: pointer;

      &.active {
        color: #1264a3;
        border-color: #1264a3;
      }
    }

    & .handle {
      position: absolute;
      right: -4px;
      bottom: -4px;
      width: 7px;
      height: 7px;
      border: 1px solid #fff;
      background: #1264a3;
      cursor: crosshair;
      z-index: 3;
    }

    & input.edit {
      position: absolute;
      inset: 0;
      width: 100%;
      min-width: 100%;
      height: 100%;
      box-sizing: border-box;
      padding: 0 4px;
      border: 2px solid #1264a3;
      background: var(--bg);
      color: var(--text);
      font: inherit;
      outline: none;
      z-index: 4;
    }
  }

  & .hdr {
    position: absolute;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    border-right: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    background: var(--bg-subtle);
    color: var(--text-muted);
    font-size: 11px;
    cursor: pointer;

    &.active {
      background: var(--bg-selected);
      color: #1264a3;
      font-weight: 700;
    }

    & .rz-c {
      position: absolute;
      top: 0;
      right: -3px;
      width: 6px;
      height: 100%;
      cursor: col-resize;
      z-index: 2;
    }

    & .rz-r {
      position: absolute;
      left: 0;
      bottom: -3px;
      width: 100%;
      height: 6px;
      cursor: row-resize;
      z-index: 2;
    }
  }

  & .chart {
    position: absolute;
    box-sizing: border-box;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
    cursor: move;
    z-index: 5;

    &.selected {
      outline: 2px solid #1264a3;
    }

    & .chart-rz {
      position: absolute;
      right: -5px;
      bottom: -5px;
      width: 10px;
      height: 10px;
      border: 1.5px solid #1264a3;
      border-radius: 2px;
      background: white;
      cursor: nwse-resize;
    }
  }

  & .cell-input {
    position: absolute;
    z-index: 20;
    box-sizing: border-box;
    padding: 0 4px;
    border: none;
    background: transparent;
    color: transparent;
    caret-color: transparent;
    font: inherit;
    outline: none;
    pointer-events: none;

    &.on {
      border: 2px solid #1264a3;
      background: var(--bg);
      color: var(--text);
      caret-color: auto;
      pointer-events: auto;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }
  }

  & .suggest {
    position: absolute;
    z-index: 30;
    min-width: 160px;
    max-height: 200px;
    overflow-y: auto;
    padding: 2px 0;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
    font-size: 12px;
    font-family: Monaco, Menlo, Consolas, monospace;

    & div {
      padding: 3px 10px;
      cursor: pointer;

      &.on {
        background: var(--bg-selected);
        color: #1264a3;
      }
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
    border-bottom: 3px solid transparent;
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

export const DialogBody = styled.div`
  font-size: 14px;

  & .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  & label {
    font-weight: 600;
  }

  & input[type='text'],
  & input[type='number'],
  & select,
  & textarea {
    height: 32px;
    padding: 0 8px;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text);
    font-size: 14px;
  }

  & textarea {
    width: 100%;
    height: 80px;
    padding: 8px;
    box-sizing: border-box;
  }

  & ul {
    list-style: none;
    margin: 0 0 12px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 6px;

    & li {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-bottom: 1px solid var(--border);
      font-size: 13px;

      &:last-child {
        border-bottom: none;
      }

      & .sample {
        padding: 1px 8px;
        border-radius: 3px;
      }

      & button {
        margin-left: auto;
      }
    }
  }

  & .charts {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;

    & button {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      width: 76px;
      padding: 8px 4px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--bg);
      color: var(--text);
      font-size: 12px;
      cursor: pointer;

      &.on {
        border-color: #1264a3;
        background: var(--bg-selected);
        color: #1264a3;
      }
    }
  }
`;
