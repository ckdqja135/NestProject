import styled from '@emotion/styled';

export const PinnedSection = styled.section`
  & .pin-item {
    position: relative;

    &.dragging {
      opacity: 0.4;
    }

    &.drop {
      box-shadow: inset 0 2px 0 #36c5f0;
    }

    & .unpin {
      position: absolute;
      top: 50%;
      right: 10px;
      display: none;
      padding: 3px;
      border: none;
      border-radius: 4px;
      background: #3f0e40;
      color: rgb(188, 171, 188);
      transform: translateY(-50%);
      cursor: pointer;

      &:hover {
        color: white;
        background: rgba(255, 255, 255, 0.15);
      }
    }

    &:hover .unpin,
    & .unpin:focus-visible {
      display: inline-flex;
    }
  }

  & a.thread-link {
    height: auto;
    min-height: 28px;
    line-height: 1.3;
    padding-top: 3px;
    padding-bottom: 3px;
    padding-right: 34px;
    gap: 6px;

    &.here {
      color: white;
    }

    & .thread-text {
      display: flex;
      flex-direction: column;
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;

      & .t,
      & small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      & small {
        font-size: 11px;
        opacity: 0.7;
      }
    }
  }
`;
