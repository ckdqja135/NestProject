import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { MOBILE } from '@utils/media';

const rise = keyframes`from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none }`;

// 허들 조작 버튼 (작은 막대·큰 화면 공통)
const controls = `
  & .controls {
    display: flex;
    justify-content: center;
    gap: 6px;

    & button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.12);
      color: white;
      cursor: pointer;
      transition: background 120ms;

      &:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.22);
      }

      &:disabled {
        opacity: 0.4;
        cursor: default;
      }

      &.off {
        background: #e01e5a;
      }

      &.on {
        background: #2eb67d;
      }

      &.leave {
        background: #e01e5a;

        &:hover {
          background: #c0174c;
        }
      }
    }
  }
`;

// 작게: 사이드바 아래쪽에 떠 있는 막대
export const HuddleBar = styled.div`
  position: fixed;
  left: 75px;
  bottom: 12px;
  z-index: 55;
  width: 240px;
  padding: 10px 12px 12px;
  border-radius: 12px;
  background: #1f2328;
  color: white;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
  animation: ${rise} 0.2s ease-out;

  & .top {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;

    & .icon {
      color: #2eb67d;
      flex: none;
    }

    & .title {
      flex: 1;
      min-width: 0;
      padding: 0;
      border: none;
      background: transparent;
      color: white;
      font-weight: 700;
      font-size: 13px;
      text-align: left;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: pointer;

      &:hover {
        text-decoration: underline;
      }
    }

    & .time {
      color: rgba(255, 255, 255, 0.6);
      font-variant-numeric: tabular-nums;
    }
  }

  & .people {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin: 10px 0;

    & .face {
      position: relative;
      display: inline-flex;
      border-radius: 8px;
      box-shadow: 0 0 0 2px transparent;
      transition: box-shadow 120ms;

      &.speaking {
        box-shadow: 0 0 0 2px #2eb67d;
      }

      & img {
        width: 28px;
        height: 28px;
        border-radius: 8px;
      }

      & i {
        position: absolute;
        right: -3px;
        bottom: -3px;
        display: inline-flex;
        padding: 1px;
        border-radius: 50%;
        background: #e01e5a;
        color: white;
      }
    }

    & .sharing {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border: none;
      border-radius: 10px;
      background: rgba(46, 182, 125, 0.25);
      color: #7ee2b8;
      font-size: 11px;
      cursor: pointer;
    }
  }

  ${controls}

  ${MOBILE} {
    left: 12px;
    right: 12px;
    width: auto;
  }
`;

// 크게: 참여자 타일과 화면 공유
export const HuddleStage = styled.div`
  position: fixed;
  top: 54px;
  right: 16px;
  bottom: 16px;
  left: 340px;
  z-index: 55;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px 16px;
  border-radius: 14px;
  background: #15171a;
  color: white;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
  animation: ${rise} 0.2s ease-out;

  & header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;

    & svg {
      color: #2eb67d;
    }

    & .time,
    & .count {
      color: rgba(255, 255, 255, 0.6);
      font-variant-numeric: tabular-nums;
    }

    & .count {
      margin-left: auto;
    }
  }

  & .stage {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;

    &.with-screen {
      flex-direction: row;

      & .screens {
        flex: 3;
      }

      & .people {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow-y: auto;

        & .tile {
          flex: none;
          aspect-ratio: 16 / 10;
        }
      }
    }
  }

  & .screens {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;

    & .tile {
      flex: 1;
    }

    & video {
      object-fit: contain;
    }
  }

  & .people {
    flex: 1;
    min-height: 0;
    display: grid;
    gap: 10px;
    grid-template-columns: repeat(2, minmax(0, 1fr));

    &.n1 {
      grid-template-columns: minmax(0, 1fr);
    }

    &.n5,
    &.n6 {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  & .tile {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
    overflow: hidden;
    border-radius: 12px;
    background: #2a2e33;
    box-shadow: inset 0 0 0 3px transparent;
    transition: box-shadow 120ms;

    &.speaking {
      box-shadow: inset 0 0 0 3px #2eb67d;
    }

    &[data-connected='false'] {
      opacity: 0.6;
    }

    & .avatar {
      width: min(96px, 40%);
      aspect-ratio: 1;
      height: auto;
      border-radius: 18px;
    }

    & video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      background: black;

      &.mirror {
        transform: scaleX(-1);
      }
    }

    & .label {
      position: absolute;
      left: 8px;
      bottom: 8px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      max-width: calc(100% - 16px);
      padding: 3px 8px;
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.55);
      font-size: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;

      & em {
        font-style: normal;
        color: rgba(255, 255, 255, 0.65);
      }
    }
  }

  ${controls}

  & .controls button {
    width: 44px;
    height: 44px;
  }

  ${MOBILE} {
    inset: 38px 0 0 0;
    border-radius: 0;

    & .stage.with-screen {
      flex-direction: column;
    }

    & .people,
    & .people.n5,
    & .people.n6 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
`;
