import { ICalendarEvent, IUser } from '@typings/db';
import dayjs, { Dayjs } from 'dayjs';
import React, { FC } from 'react';
import { Chip, MonthGrid } from './styles';
import { eventColor, eventLabel, isAllDayRow, monthGrid, overlapsDay, WEEKDAYS } from './utils';

interface Props {
  cursor: Dayjs;
  events: ICalendarEvent[];
  me: number;
  follows: IUser[];
  onOpen: (event: ICalendarEvent) => void;
  onCreate: (day: Dayjs) => void;
  onMore: (day: Dayjs) => void;
}

const MAX_CHIPS = 3;

const MonthView: FC<Props> = ({ cursor, events, me, follows, onOpen, onCreate, onMore }) => {
  const today = dayjs();
  return (
    <MonthGrid role="grid" aria-label={cursor.format('YYYY년 M월')}>
      {WEEKDAYS.map((w) => (
        <div key={w} className="wd">
          {w}
        </div>
      ))}
      {monthGrid(cursor).map((day) => {
        const list = events
          .filter((e) => overlapsDay(e, day))
          .sort((a, b) => Number(isAllDayRow(b)) - Number(isAllDayRow(a)) || a.startAt.localeCompare(b.startAt));
        const shown = list.slice(0, MAX_CHIPS);
        const classes = ['cell'];
        if (!day.isSame(cursor, 'month')) classes.push('other');
        if (day.isSame(today, 'day')) classes.push('today');
        return (
          <div
            key={day.valueOf()}
            className={classes.join(' ')}
            role="gridcell"
            onClick={() => onCreate(day)}
            title="누르면 이 날에 일정을 만듭니다"
          >
            <span className="num">{day.date() === 1 ? day.format('M/D') : day.date()}</span>
            {shown.map((event) => (
              <Chip
                key={event.id}
                type="button"
                className={
                  [
                    event.masked
                      ? 'masked'
                      : event.myStatus === 'declined'
                      ? 'declined'
                      : event.myStatus === 'pending'
                      ? 'pending'
                      : '',
                    event.calendars.includes(me) ? '' : 'follow',
                  ]
                    .filter(Boolean)
                    .join(' ') || undefined
                }
                style={{ ['--chip' as string]: eventColor(event, me, follows) }}
                title={eventLabel(event, me, follows)}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen(event);
                }}
              >
                {!isAllDayRow(event) && <span>{dayjs(event.startAt).format('HH:mm')} </span>}
                {eventLabel(event, me, follows)}
              </Chip>
            ))}
            {list.length > MAX_CHIPS && (
              <button
                type="button"
                className="more"
                onClick={(e) => {
                  e.stopPropagation();
                  onMore(day);
                }}
              >
                +{list.length - MAX_CHIPS} 더보기
              </button>
            )}
          </div>
        );
      })}
    </MonthGrid>
  );
};

export default MonthView;
