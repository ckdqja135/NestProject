import styled from '@emotion/styled';
import { MOBILE } from '@utils/media';

export const SlidesWrap = styled.div`
  display: flex;
  flex-direction: column;
  height: calc(100vh - 38px - 140px);
  min-height: 420px;
  margin: 0 20px 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg);

  ${MOBILE} {
    margin: 0 8px 8px;
    height: auto;
  }
`;

export const Bar = styled.div`
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

  & .group {
    position: relative;
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

export const Menu = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 20;
  min-width: 170px;
  padding: 4px 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.15);

  & button {
    display: flex !important;
    justify-content: flex-start !important;
    width: 100%;
    gap: 8px !important;
    padding: 6px 12px !important;
    border-radius: 0 !important;
    font-size: 13px !important;
  }

  & form {
    display: flex;
    gap: 4px;
    padding: 6px 8px;

    & input {
      flex: 1;
      min-width: 0;
      height: 26px;
      padding: 0 6px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--bg);
      color: var(--text);
      font-size: 12px;
    }
  }
`;

export const Body = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;

  ${MOBILE} {
    flex-direction: column-reverse;
  }
`;

export const Thumbs = styled.div`
  flex: 0 0 176px;
  padding: 10px 8px;
  border-right: 1px solid var(--border);
  background: var(--bg-subtle);
  overflow-y: auto;

  ${MOBILE} {
    flex: none;
    display: flex;
    gap: 8px;
    border-right: none;
    border-top: 1px solid var(--border);
    overflow-x: auto;
  }

  & .thumb {
    position: relative;
    display: flex;
    gap: 6px;
    margin-bottom: 10px;
    cursor: pointer;

    & .no {
      width: 14px;
      font-size: 11px;
      color: var(--text-muted);
      text-align: right;
    }

    & .frame {
      border: 2px solid var(--border);
      border-radius: 4px;
      overflow: hidden;
    }

    &.active .frame {
      border-color: #1264a3;
    }

    & .tools {
      position: absolute;
      right: 2px;
      top: 2px;
      display: none;
      gap: 2px;

      & button {
        display: inline-flex;
        padding: 2px;
        border: none;
        border-radius: 3px;
        background: rgba(0, 0, 0, 0.55);
        color: white;
        cursor: pointer;
      }
    }

    &:hover .tools {
      display: flex;
    }
  }

  & .add {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    width: 100%;
    height: 32px;
    border: 1px dashed var(--border-strong);
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted);
    font-size: 12px;
    cursor: pointer;
  }
`;

export const Stage = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow: auto;
  background: var(--bg-hover);

  & .canvas-box {
    position: relative;
    margin: 0 auto;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
    outline: none;
  }

  & .el {
    position: absolute;
    box-sizing: border-box;

    &.editable {
      cursor: move;
    }

    &.empty-text {
      outline: 1px dashed rgba(127, 127, 127, 0.6);
    }

    &.selected {
      outline: 2px solid #1264a3;
      outline-offset: 0;
    }

    & textarea {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      padding: 6px 10px;
      border: none;
      background: rgba(255, 255, 255, 0.92);
      color: #1d1c1d;
      font-family: inherit;
      line-height: 1.3;
      resize: none;
      outline: 2px solid #1264a3;
      z-index: 5;
    }
  }

  & .handle {
    position: absolute;
    width: 10px;
    height: 10px;
    margin: -5px 0 0 -5px;
    border: 1.5px solid #1264a3;
    border-radius: 2px;
    background: white;
    z-index: 6;
  }

  & .guide {
    position: absolute;
    background: #e0405a;
    pointer-events: none;
    z-index: 7;
  }

  & .notes {
    width: 100%;
    max-width: 960px;
    margin: 12px auto 0;

    & textarea {
      width: 100%;
      box-sizing: border-box;
      min-height: 54px;
      padding: 8px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg);
      color: var(--text);
      font-size: 13px;
      resize: vertical;
    }
  }

  & .hint {
    margin: 8px auto 0;
    font-size: 12px;
    color: var(--text-muted);
  }
`;
