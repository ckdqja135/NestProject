import dayjs, { Dayjs } from 'dayjs';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import React, { FC, useEffect, useState } from 'react';
import { MiniCal } from './styles';
import { monthGrid, WEEKDAYS } from './utils';

interface Props {
  cursor: Dayjs;
  marked?: Set<string>; // 일정이 있는 날 (YYYY-MM-DD)
  onPick: (day: Dayjs) => void;
}

const MiniCalendar: FC<Props> = ({ cursor, marked, onPick }) => {
  const [month, setMonth] = useState(cursor.startOf('month'));
  useEffect(() => {
    setMonth(cursor.startOf('month'));
  }, [cursor]);
  const today = dayjs();
  return (
    <MiniCal aria-label="작은 달력">
      <div className="head">
        <button type="button" onClick={() => setMonth((m) => m.subtract(1, 'month'))} aria-label="이전 달">
          <ChevronLeft size={16} />
        </button>
        <span>{month.format('YYYY년 M월')}</span>
        <button type="button" onClick={() => setMonth((m) => m.add(1, 'month'))} aria-label="다음 달">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid">
        {WEEKDAYS.map((w) => (
          <span key={w} className="wd">
            {w}
          </span>
        ))}
        {monthGrid(month).map((day) => {
          const classes = ['day'];
          if (!day.isSame(month, 'month')) classes.push('other');
          if (day.isSame(today, 'day')) classes.push('today');
          if (day.isSame(cursor, 'day')) classes.push('selected');
          if (marked?.has(day.format('YYYY-MM-DD'))) classes.push('has');
          return (
            <button
              key={day.valueOf()}
              type="button"
              className={classes.join(' ')}
              onClick={() => onPick(day)}
              aria-label={day.format('YYYY년 M월 D일')}
            >
              {day.date()}
            </button>
          );
        })}
      </div>
    </MiniCal>
  );
};

export default MiniCalendar;
