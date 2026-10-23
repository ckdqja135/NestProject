import styled from '@emotion/styled';
import { MOBILE } from '@utils/media';

const BLUE = '#0d99ff';

// 디자인 편집기: 왼쪽(페이지·레이어) | 캔버스 | 오른쪽(속성)
export const DesignWrap = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr) 248px;
  min-height: 420px;
  border-top: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-size: 12px;
  outline: none;

  & > .panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    background: var(--bg);
  }

  & > .panel.left {
    border-right: 1px solid var(--border);
  }

  & > .panel.right {
    border-left: 1px solid var(--border);
  }

  & .stage {
    position: relative;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  & .status-pill {
    position: absolute;
    top: 12px;
    left: 50%;
    z-index: 6;
    transform: translateX(-50%);
    padding: 6px 14px;
    border-radius: 16px;
    background: rgba(0, 0, 0, 0.72);
    color: white;
    font-size: 13px;
    pointer-events: none;
  }

  & .section-title {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 32px;
    padding: 0 8px 0 14px;
    font-size: 11px;
    font-weight: 700;
    color: var(--text);

    & .grow {
      flex: 1;
    }
  }

  & .panel-toggles {
    display: none;
  }

  /* 좁은 화면: 캔버스만 크게, 레이어·속성은 버튼으로 열어 위에 띄운다 (규칙 순서상 맨 아래에 둔다) */
  ${MOBILE} {
    grid-template-columns: minmax(0, 1fr);

    & > .panel {
      position: absolute;
      top: 0;
      bottom: 0;
      z-index: 8;
      display: none;
      width: min(280px, 85%);
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.2);
    }

    & > .panel.left {
      left: 0;
    }

    & > .panel.right {
      right: 0;
    }

    & > .panel.open {
      display: flex;
    }

    & .panel-toggles {
      position: absolute;
      top: 10px;
      left: 10px;
      right: 10px;
      z-index: 6;
      display: flex;
      justify-content: space-between;
      pointer-events: none;

      & button {
        padding: 6px 10px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--bg);
        color: var(--text);
        font-size: 12px;
        font-weight: 600;
        pointer-events: all;
        cursor: pointer;
      }
    }
  }

  & .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;

    &:hover {
      background: var(--bg-hover);
      color: var(--text);
    }

    &.on {
      background: rgba(13, 153, 255, 0.15);
      color: ${BLUE};
    }

    &:disabled {
      opacity: 0.4;
      cursor: default;
    }
  }
`;

export const CanvasWrap = styled.div`
  position: absolute;
  inset: 0;
  overflow: hidden;
  outline: none;
  user-select: none;
  touch-action: none;

  & > svg {
    position: absolute;
    inset: 0;
    display: block;
  }

  & > svg.overlay {
    pointer-events: none;
  }

  & .design-text {
    user-select: none;
  }

  & .frame-label {
    position: absolute;
    overflow: hidden;
    padding: 0 2px;
    color: var(--text-muted);
    font-size: 11px;
    line-height: 18px;
    white-space: nowrap;
    text-overflow: ellipsis;
    cursor: default;

    &:hover {
      color: ${BLUE};
    }

    &.on {
      color: ${BLUE};
      font-weight: 600;
    }
  }

  & .frame-rename {
    position: absolute;
    width: 160px;
    height: 20px;
    padding: 0 4px;
    border: 1px solid ${BLUE};
    border-radius: 3px;
    background: var(--bg);
    color: var(--text);
    font-size: 11px;
    outline: none;
  }

  & .size-label {
    position: absolute;
    transform: translateX(-50%);
    padding: 1px 6px;
    border-radius: 4px;
    background: ${BLUE};
    color: white;
    font-size: 11px;
    line-height: 16px;
    white-space: nowrap;
    pointer-events: none;
  }

  & .pin {
    position: absolute;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    height: 28px;
    padding: 0 6px;
    border: 2px solid white;
    border-radius: 14px 14px 14px 3px;
    background: #fff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
    color: #1e1e1e;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;

    &.on {
      background: ${BLUE};
      color: white;
    }
  }

  & .remote-cursor {
    position: absolute;
    display: flex;
    align-items: flex-start;
    pointer-events: none;
    transform: translate(-2px, -2px);

    & span {
      margin: 14px 0 0 -4px;
      padding: 1px 6px;
      border-radius: 4px;
      color: white;
      font-size: 11px;
      white-space: nowrap;
    }
  }

  & .text-editor {
    position: absolute;
    box-sizing: content-box;
    margin: 0;
    padding: 0;
    border: none;
    outline: 1px solid ${BLUE};
    background: transparent;
    resize: none;
    overflow: hidden;
  }
`;

// 아래 가운데 떠 있는 도구 막대 (Figma UI3 처럼)
export const Toolbar = styled.div`
  position: absolute;
  bottom: 16px;
  left: 50%;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px;
  transform: translateX(-50%);
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.14);

  & .sep {
    width: 1px;
    height: 20px;
    margin: 0 4px;
    background: var(--border);
  }

  & button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    padding: 0;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text);
    cursor: pointer;

    &:hover {
      background: var(--bg-hover);
    }

    &.on {
      background: ${BLUE};
      color: white;
    }
  }
`;

export const LayersWrap = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;

  & .file {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 10px 8px 10px 10px;
    border-bottom: 1px solid var(--border);

    & input {
      flex: 1;
      min-width: 0;
      padding: 4px 6px;
      border: 1px solid transparent;
      border-radius: 5px;
      background: transparent;
      color: var(--text);
      font-size: 13px;
      font-weight: 700;
      outline: none;

      &:hover {
        border-color: var(--border);
      }

      &:focus {
        border-color: ${BLUE};
      }
    }
  }

  & .pages {
    flex: none;
    max-height: 30%;
    overflow-y: auto;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--border);
  }

  & .layers {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding-bottom: 24px;
  }

  & .row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding-right: 6px;
    color: var(--text);
    cursor: default;

    &:hover {
      background: var(--bg-hover);
    }

    &.on {
      background: rgba(13, 153, 255, 0.16);
    }

    &.child-of-on {
      background: rgba(13, 153, 255, 0.06);
    }

    &.hover-canvas {
      box-shadow: inset 0 0 0 1px ${BLUE};
    }

    &.dim .name {
      opacity: 0.45;
    }

    &.drop-above::before,
    &.drop-below::after {
      content: '';
      position: absolute;
      left: 8px;
      right: 8px;
      height: 2px;
      background: ${BLUE};
    }

    &.drop-above::before {
      top: -1px;
    }

    &.drop-below::after {
      bottom: -1px;
    }

    &.drop-inside {
      box-shadow: inset 0 0 0 2px ${BLUE};
    }

    & .chev {
      display: inline-flex;
      width: 14px;
      color: var(--text-muted);
      cursor: pointer;
    }

    & .type {
      flex: none;
      color: var(--text-muted);
    }

    & .name {
      flex: 1;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    & .frame-name {
      font-weight: 600;
    }

    & input {
      flex: 1;
      min-width: 0;
      height: 22px;
      padding: 0 4px;
      border: 1px solid ${BLUE};
      border-radius: 3px;
      background: var(--bg);
      color: var(--text);
      font-size: 12px;
      outline: none;
    }

    & .toggles {
      display: none;
      gap: 0;
    }

    &:hover .toggles,
    & .toggles.stay {
      display: inline-flex;
    }
  }

  & .page-row {
    padding-left: 14px;

    &.on {
      background: transparent;
      font-weight: 700;
    }
  }

  & .empty {
    padding: 10px 14px;
    color: var(--text-faint);
    line-height: 1.5;
  }
`;

export const InspectorWrap = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;

  & .top {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 10px;
    border-bottom: 1px solid var(--border);

    & .people {
      display: flex;
      flex: 1;
      min-width: 0;

      & button {
        width: 24px;
        height: 24px;
        margin-right: -4px;
        padding: 0;
        border: 2px solid var(--bg);
        border-radius: 50%;
        color: white;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
      }
    }
  }

  & .zoom-btn {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 4px 6px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--text);
    font-size: 12px;
    cursor: pointer;

    &:hover {
      background: var(--bg-hover);
    }
  }

  & .tabs {
    display: flex;
    gap: 2px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--border);

    & button {
      padding: 4px 8px;
      border: none;
      border-radius: 5px;
      background: transparent;
      color: var(--text-muted);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;

      &.on {
        background: var(--bg-hover);
        color: var(--text);
      }
    }
  }

  & .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding-bottom: 24px;
  }

  & section {
    padding: 4px 10px 10px;
    border-bottom: 1px solid var(--border);

    & > h4 {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 30px;
      margin: 0;
      font-size: 11px;
      font-weight: 700;
    }
  }

  & .kind {
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    font-weight: 700;
  }

  & .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  & .line {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
  }

  & .num,
  & .hex,
  & select {
    display: flex;
    align-items: center;
    min-width: 0;
    height: 28px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: var(--bg-subtle);
    color: var(--text);

    &:hover {
      border-color: var(--border);
    }

    &:focus-within,
    &:focus {
      border-color: ${BLUE};
      outline: none;
    }
  }

  & select {
    padding: 0 6px;
    font-size: 12px;
  }

  & .num {
    & > span {
      flex: none;
      display: inline-flex;
      justify-content: center;
      width: 22px;
      color: var(--text-faint);
      cursor: ew-resize;
    }

    & input {
      flex: 1;
      min-width: 0;
      height: 100%;
      padding: 0 4px 0 0;
      border: none;
      background: transparent;
      color: var(--text);
      font-size: 12px;
      outline: none;
    }
  }

  & .hex {
    flex: 1;
    gap: 6px;
    padding: 0 6px;

    & input[type='color'] {
      flex: none;
      width: 18px;
      height: 18px;
      padding: 0;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: none;
      cursor: pointer;

      &::-webkit-color-swatch-wrapper {
        padding: 0;
      }

      &::-webkit-color-swatch {
        border: none;
        border-radius: 3px;
      }
    }

    & input[type='text'] {
      flex: 1;
      min-width: 0;
      border: none;
      background: transparent;
      color: var(--text);
      font-size: 12px;
      text-transform: uppercase;
      outline: none;
    }
  }

  & .seg {
    display: inline-flex;
    padding: 2px;
    border-radius: 6px;
    background: var(--bg-subtle);

    & button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 24px;
      min-width: 28px;
      padding: 0 6px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: var(--text-muted);
      font-size: 11px;
      cursor: pointer;

      &.on {
        background: var(--bg);
        color: var(--text);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
      }
    }
  }

  & .align {
    display: flex;
    justify-content: space-between;
    padding: 8px 10px;
    border-bottom: 1px solid var(--border);
  }

  & label.check {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    cursor: pointer;
  }

  & .presets {
    & h5 {
      margin: 10px 0 4px;
      color: var(--text-faint);
      font-size: 11px;
      font-weight: 600;
    }

    & button {
      display: flex;
      justify-content: space-between;
      width: 100%;
      padding: 6px 8px;
      border: none;
      border-radius: 5px;
      background: transparent;
      color: var(--text);
      font-size: 12px;
      text-align: left;
      cursor: pointer;

      &:hover {
        background: var(--bg-hover);
      }

      & small {
        color: var(--text-faint);
      }
    }
  }

  & .primary {
    width: 100%;
    margin-top: 8px;
    padding: 7px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;

    &:hover {
      background: var(--bg-hover);
    }
  }

  & pre {
    margin: 0;
    padding: 10px;
    border-radius: 6px;
    background: var(--bg-subtle);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11.5px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
  }

  & .hint {
    padding: 14px;
    color: var(--text-faint);
    line-height: 1.6;
  }
`;

export const Menu = styled.div`
  position: fixed;
  z-index: 1000;
  min-width: 210px;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
  color: var(--text);
  font-size: 12px;

  & button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    width: 100%;
    height: 28px;
    padding: 0 10px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: inherit;
    font-size: 12px;
    text-align: left;
    cursor: pointer;

    &:hover:not(:disabled) {
      background: ${BLUE};
      color: white;

      & kbd {
        color: rgba(255, 255, 255, 0.85);
      }
    }

    &:disabled {
      opacity: 0.4;
      cursor: default;
    }

    & kbd {
      color: var(--text-faint);
      font-family: inherit;
      font-size: 11px;
    }
  }

  & hr {
    margin: 4px 0;
    border: none;
    border-top: 1px solid var(--border);
  }
`;
