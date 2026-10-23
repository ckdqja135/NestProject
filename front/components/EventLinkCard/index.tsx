import { Card, CardBox } from '@components/DocLinkCard/styles';
import { ICalendarEvent } from '@typings/db';
import fetcher from '@utils/fetcher';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import dayjs from 'dayjs';
import { CalendarDays, Lock } from 'lucide-react';
import React, { FC } from 'react';
import { toast } from 'react-toastify';
import useSWR from 'swr';
import { Rsvp } from './styles';

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const day = (d: dayjs.Dayjs) => `${d.format('M/D')} (${DAYS[d.day()]})`;

const when = (event: ICalendarEvent) => {
  const start = dayjs(event.startAt);
  if (event.allDay) {
    const last = dayjs(event.endAt).subtract(1, 'day');
    return last.isSame(start, 'day') ? `${day(start)} 종일` : `${start.format('M/D')} ~ ${last.format('M/D')} 종일`;
  }
  return `${day(start)} ${start.format('HH:mm')} ~ ${dayjs(event.endAt).format('HH:mm')}`;
};

// 메시지 속 일정 링크를 카드로: 제목·시간·참석 인원, 초대받았으면 바로 참석·불참
const EventLinkCard: FC<{ workspace: string; id: number }> = ({ workspace, id }) => {
  const key = `/api/workspaces/${workspace}/calendar/events/${id}`;
  const {
    data: event,
    error,
    mutate,
  } = useSWR<ICalendarEvent>(key, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  if (error || event?.masked) {
    return (
      <CardBox className="doc-card denied" data-event-card={id}>
        <span className="icon">
          <Lock size={16} />
        </span>
        <span className="text">
          <small>일정</small>
          <b>볼 수 없는 일정이에요</b>
        </span>
      </CardBox>
    );
  }
  if (!event) return <CardBox className="doc-card loading" aria-hidden="true" />;
  const going = event.Attendees.filter((a) => a.status === 'accepted').length;
  const invited = event.myStatus && event.myStatus !== 'owner';
  const rsvp = (status: 'accepted' | 'declined') =>
    axios
      .put<ICalendarEvent>(`${key}/rsvp`, { status })
      .then(({ data }) => {
        mutate(data, false);
        toast.info(status === 'accepted' ? '참석으로 답했어요.' : '불참으로 답했어요.', { position: 'bottom-center' });
      })
      .catch((err) => toast.error(getErrorMessage(err), { position: 'bottom-center' }));
  return (
    <div data-event-card={id}>
      <Card to={`/workspace/${workspace}/calendar?event=${id}`} className="doc-card">
        <span className="icon" style={{ color: '#e8891d', background: '#e8891d1f' }}>
          <CalendarDays size={18} />
        </span>
        <span className="text">
          <small>
            일정 · {when(event)} · 참석 {going}/{event.Attendees.length}명
          </small>
          <b>{event.title}</b>
        </span>
        <span className="open">열기 →</span>
      </Card>
      {invited && (
        <Rsvp role="group" aria-label="참석 여부">
          <button
            type="button"
            className={event.myStatus === 'accepted' ? 'on' : undefined}
            onClick={() => rsvp('accepted')}
          >
            참석
          </button>
          <button
            type="button"
            className={event.myStatus === 'declined' ? 'on' : undefined}
            onClick={() => rsvp('declined')}
          >
            불참
          </button>
        </Rsvp>
      )}
    </div>
  );
};

export default EventLinkCard;
