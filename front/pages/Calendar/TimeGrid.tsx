import { ICalendarEvent, IUser } from '@typings/db';
import dayjs, { Dayjs } from 'dayjs';
import React, { FC, useEffect, useRef, useState } from 'react';
import { Chip, TimeGridWrap } from './styles';
import { eventColor, HOUR_PX, isAllDayRow, layoutColumns, overlapsDay, WEEKDAYS } from './utils';

interface Props {
  days: Dayjs[]; // 주: 7일, 일: 1일
  events: ICalendarEvent[];
  me: number;
  follows: IUser[];
  onOpen: (event: ICalendarEvent) => void;
  onCreate: (start: Dayjs, allDay: boolean) => void;
}

const statusClass = (event: ICalendarEvent) =>
  event.masked ? 'masked' : event.myStatus === 'declined' ? 'declined' : event.myStatus === 'pending' ? 'pending' : '';

// 주·일 보기: 위에 종일 줄, 아래 24시간 시간표
const TimeGrid: FC<Props> = ({ days, events, me, follows, onOpen, onCreate }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(dayjs());
  useEffect(() => {
    // 처음엔 아침 8시가 보이게
    scrollRef.current?.scrollTo({ top: HOUR_PX * 8 - 10 });
    const timer = window.setInterval(() => setNow(dayjs()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const onColumnClick = (day: Dayjs) => (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.event')) {
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const hour = Math.floor((e.clientY - rect.top) / HOUR_PX);
    onCreate(day.hour(Math.min(23, Math.max(0, hour))).minute(0), false);
  };

  return (
    <TimeGridWrap style={{ ['--cols' as string]: days.length }}>
      <div className="top">
        <div className="gutter">종일</div>
        {days.map((day) => (
          <div key={`h${day.valueOf()}`} className={`wd${day.isSame(now, 'day') ? ' today' : ''}`}>
            {WEEKDAYS[day.day()]}
            <b>{day.date()}</b>
          </div>
        ))}
        <div />
        {days.map((day) => (
          <div
            key={`a${day.valueOf()}`}
            className="allday"
            onClick={() => onCreate(day.startOf('day'), true)}
            title="누르면 종일 일정을 만듭니다"
          >
            {events
              .filter((e) => isAllDayRow(e) && overlapsDay(e, day))
              .map((event) => (
                <Chip
                  key={event.id}
                  type="button"
                  className={statusClass(event) || undefined}
                  style={{ ['--chip' as string]: eventColor(event, me, follows) }}
                  title={event.title}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(event);
                  }}
                >
                  {event.title}
                </Chip>
              ))}
          </div>
        ))}
      </div>
      <div className="scroll" ref={scrollRef}>
        <div className="body">
          <div className="hours">
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} style={{ top: h * HOUR_PX }}>
                {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
              </span>
            ))}
          </div>
          {days.map((day) => {
            const timed = events.filter((e) => !isAllDayRow(e) && overlapsDay(e, day));
            const columns = layoutColumns(timed);
            const isToday = day.isSame(now, 'day');
            return (
              <div
                key={day.valueOf()}
                className={`col${isToday ? ' today' : ''}`}
                onClick={onColumnClick(day)}
                role="presentation"
              >
                {timed.map((event) => {
                  const start = dayjs(event.startAt);
                  const end = dayjs(event.endAt);
                  const top = (start.diff(day.startOf('day'), 'minute') / 60) * HOUR_PX;
                  const height = Math.max(20, (end.diff(start, 'minute') / 60) * HOUR_PX - 2);
                  const { col, cols } = columns.get(event.id) || { col: 0, cols: 1 };
                  const width = 100 / cols;
                  return (
                    <button
                      key={event.id}
                      type="button"
                      className={`event ${statusClass(event)}`}
                      style={{
                        top,
                        height,
                        left: `${col * width}%`,
                        width: `${width}%`,
                        ['--chip' as string]: eventColor(event, me, follows),
                      }}
                      title={event.title}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(event);
                      }}
                    >
                      <b>{event.title}</b>
                      {height > 30 && (
                        <small>
                          {start.format('HH:mm')} – {end.format('HH:mm')}
                        </small>
                      )}
                    </button>
                  );
                })}
                {isToday && (
                  <div className="now" style={{ top: (now.diff(day.startOf('day'), 'minute') / 60) * HOUR_PX }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </TimeGridWrap>
  );
};

export default TimeGrid;
