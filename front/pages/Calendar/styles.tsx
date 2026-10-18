import styled from '@emotion/styled';
import { MOBILE } from '@utils/media';
import { HOUR_PX } from './utils';

export const CalLayout = styled.div`
  display: flex;
  height: calc(100vh - 38px);
  background: var(--bg);
  color: var(--text);
  overflow: hidden;
`;

export const Side = styled.aside`
  flex: 0 0 250px;
  padding: 14px 14px 20px;
  border-right: 1px solid var(--border);
  background: var(--bg-subtle);
  overflow-y: auto;

  ${MOBILE} {
    display: none;
  }

  & h4 {
    display: flex;
    align-items: center;
    margin: 18px 0 6px;
    font-size: 12px;
    color: var(--text-muted);

    & button {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      margin-left: auto;
      border: none;
      background: transparent;
      color: #1264a3;
      font-size: 12px;
      cursor: pointer;
    }
  }

  & label.cal {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 2px;
    font-size: 14px;
    cursor: pointer;

    & .dot {
      width: 12px;
      height: 12px;
      border-radius: 3px;
    }

    & .name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    & .remove {
      display: inline-flex;
      border: none;
      background: transparent;
      color: var(--text-faint);
      cursor: pointer;
    }
  }

  & a.bot {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 16px;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-size: 13px;
    text-decoration: none;

    &:hover {
      background: var(--bg-hover);
    }
  }
`;

export const MiniCal = styled.div`
  & .head {
    display: flex;
    align-items: center;
    margin-bottom: 6px;
    font-weight: 700;

    & button {
      display: inline-flex;
      border: none;
      background: transparent;
      color: var(--text-muted);
      font-size: 14px;
      cursor: pointer;
      padding: 2px 6px;
    }

    & span {
      flex: 1;
      text-align: center;
    }
  }

  & .grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    text-align: center;
    font-size: 12px;
  }

  & .wd {
    padding: 2px 0;
    color: var(--text-muted);
  }

  & .day {
    height: 28px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--text);
    font-size: 12px;
    cursor: pointer;

    &:hover {
      background: var(--bg-hover);
    }

    &.other {
      color: var(--text-faint);
    }

    &.today {
      font-weight: 800;
      color: #1264a3;
    }

    &.selected {
      background: #1264a3;
      color: white;
    }

    &.has::after {
      content: '';
      display: block;
      width: 4px;
      height: 4px;
      margin: -2px auto 0;
      border-radius: 50%;
      background: currentColor;
    }
  }
`;

export const Main = styled.main`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
`;

export const Toolbar = styled.header`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);

  ${MOBILE} {
    flex-wrap: wrap;
    padding: 8px 12px;
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
      font-weight: 700;
    }
  }

  & .title {
    margin: 0 8px;
    font-size: 18px;
    font-weight: 800;
    white-space: nowrap;

    ${MOBILE} {
      font-size: 15px;
    }
  }

  & .views {
    display: flex;
    margin-left: auto;

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

export const Chip = styled.button`
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 1px 6px;
  border: none;
  border-radius: 4px;
  background: var(--chip, #2f80ed);
  color: white;
  font-size: 12px;
  line-height: 18px;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;

  &.masked {
    background: repeating-linear-gradient(
      135deg,
      var(--chip, #6b7280),
      var(--chip, #6b7280) 4px,
      rgba(255, 255, 255, 0.25) 4px,
      rgba(255, 255, 255, 0.25) 8px
    );
  }

  &.declined {
    opacity: 0.5;
    text-decoration: line-through;
  }

  &.pending {
    background: transparent;
    border: 1px dashed var(--chip, #2f80ed);
    color: var(--text);
  }
`;

export const MonthGrid = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-template-rows: auto repeat(6, 1fr);
  min-height: 0;

  & .wd {
    padding: 6px 0;
    border-bottom: 1px solid var(--border);
    text-align: center;
    font-size: 12px;
    color: var(--text-muted);
  }

  & .cell {
    position: relative;
    min-height: 0;
    padding: 4px;
    border-right: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    overflow: hidden;
    cursor: pointer;

    &:hover {
      background: var(--bg-subtle);
    }

    &.other .num {
      color: var(--text-faint);
    }

    & .num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      margin-bottom: 2px;
      border-radius: 50%;
      font-size: 12px;
    }

    &.today .num {
      background: #1264a3;
      color: white;
      font-weight: 700;
    }

    & ${Chip} {
      margin-bottom: 2px;
    }

    & .more {
      border: none;
      background: transparent;
      color: var(--text-muted);
      font-size: 12px;
      cursor: pointer;
      padding: 0 4px;
    }
  }
`;

export const TimeGridWrap = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;

  & .top {
    display: grid;
    grid-template-columns: 50px repeat(var(--cols), 1fr);
    border-bottom: 1px solid var(--border);

    & .wd {
      padding: 6px 4px 2px;
      text-align: center;
      font-size: 12px;
      color: var(--text-muted);
      border-left: 1px solid var(--border);

      & b {
        display: block;
        font-size: 16px;
        color: var(--text);
      }

      &.today b {
        color: #1264a3;
      }
    }

    & .allday {
      min-height: 22px;
      padding: 2px 2px 4px;
      border-left: 1px solid var(--border);

      & ${Chip} {
        margin-bottom: 2px;
      }
    }

    & .gutter {
      font-size: 11px;
      color: var(--text-muted);
      text-align: right;
      padding: 4px 6px;
      align-self: end;
    }
  }

  & .scroll {
    flex: 1;
    overflow-y: auto;
  }

  & .body {
    display: grid;
    grid-template-columns: 50px repeat(var(--cols), 1fr);
    height: ${HOUR_PX * 24}px;
  }

  & .hours {
    position: relative;

    & span {
      position: absolute;
      right: 6px;
      transform: translateY(-50%);
      font-size: 11px;
      color: var(--text-muted);
    }
  }

  & .col {
    position: relative;
    border-left: 1px solid var(--border);
    background-image: linear-gradient(var(--border) 1px, transparent 1px);
    background-size: 100% ${HOUR_PX}px;
    cursor: pointer;

    &.today {
      background-color: var(--bg-highlight-soft, rgba(18, 100, 163, 0.04));
    }
  }

  & .event {
    position: absolute;
    box-sizing: border-box;
    padding: 2px 6px;
    border: 1px solid var(--bg);
    border-radius: 6px;
    background: var(--chip, #2f80ed);
    color: white;
    font-size: 12px;
    line-height: 1.3;
    text-align: left;
    overflow: hidden;
    cursor: pointer;

    & b {
      display: block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    & small {
      opacity: 0.9;
    }

    &.masked {
      background: repeating-linear-gradient(
        135deg,
        var(--chip, #6b7280),
        var(--chip, #6b7280) 4px,
        rgba(255, 255, 255, 0.25) 4px,
        rgba(255, 255, 255, 0.25) 8px
      );
    }

    &.declined {
      opacity: 0.5;
      text-decoration: line-through;
    }

    &.pending {
      background: var(--bg);
      border: 1px dashed var(--chip, #2f80ed);
      color: var(--text);
    }
  }

  & .now {
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    background: #e0405a;
    pointer-events: none;

    &::before {
      content: '';
      position: absolute;
      left: -4px;
      top: -3px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #e0405a;
    }
  }
`;

export const Detail = styled.div`
  & .when {
    font-size: 15px;
    margin: 0 0 6px;
  }

  & p {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 4px 0;
    font-size: 14px;
  }

  & p.desc {
    display: block;
  }

  & .desc {
    white-space: pre-wrap;
    color: var(--text-muted);
  }

  & ul {
    list-style: none;
    margin: 6px 0 0;
    padding: 0;

    & li {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 3px 0;
      font-size: 14px;

      & img {
        width: 22px;
        height: 22px;
        border-radius: 5px;
      }

      & small {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: var(--text-muted);
      }
    }
  }

  & .rsvp {
    display: flex;
    gap: 8px;
    margin-top: 14px;

    & button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 34px;
      padding: 0 14px;
      border: 1px solid var(--border-strong);
      border-radius: 6px;
      background: var(--bg);
      color: var(--text);
      font-size: 14px;
      cursor: pointer;

      &.on {
        border-color: #1264a3;
        background: var(--bg-selected);
        color: #1264a3;
        font-weight: 700;
      }
    }
  }
`;

export const Swatches = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;

  & button {
    width: 24px;
    height: 24px;
    border: 2px solid transparent;
    border-radius: 50%;
    cursor: pointer;

    &.on {
      border-color: var(--text);
    }

    &.none {
      width: auto;
      padding: 0 10px;
      border-radius: 12px;
      background: var(--bg);
      border-color: var(--border-strong);
      color: var(--text-muted);
      font-size: 12px;
      white-space: nowrap;
    }
  }
`;

export const PeopleList = styled.div`
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 8px;

  & label,
  & .row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    font-size: 14px;
    cursor: pointer;

    &:hover {
      background: var(--bg-subtle);
    }

    & img {
      width: 24px;
      height: 24px;
      border-radius: 5px;
    }

    & .who {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;

      & small {
        color: var(--text-muted);
        margin-left: 6px;
      }
    }

    & button {
      height: 26px;
      padding: 0 10px;
      border: 1px solid var(--border-strong);
      border-radius: 6px;
      background: var(--bg);
      color: var(--text);
      font-size: 12px;
      cursor: pointer;

      &.on {
        border-color: #1264a3;
        color: #1264a3;
      }
    }
  }

  & p {
    margin: 10px;
    font-size: 13px;
    color: var(--text-muted);
  }
`;

export const Row = styled.div`
  display: flex;
  gap: 10px;

  & > * {
    flex: 1;
    min-width: 0;
  }

  ${MOBILE} {
    flex-direction: column;
    gap: 0;
  }
`;
