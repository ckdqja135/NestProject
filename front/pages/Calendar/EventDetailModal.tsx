import Modal from '@components/Modal';
import { Actions } from '@components/ModalForm/styles';
import { ICalendarEvent, IUser, RsvpStatus } from '@typings/db';
import { avatarUrl } from '@utils/avatar';
import axios from 'axios';
import React, { FC, useState } from 'react';
import { toast } from 'react-toastify';
import { calBase, toastError } from './api';
import { Detail } from './styles';
import { eventColor, fmtWhen, REMINDERS, STATUS_ICON, STATUS_LABEL } from './utils';

interface Props {
  show: boolean;
  workspace: string;
  event: ICalendarEvent | null;
  me: IUser;
  follows: IUser[];
  onClose: () => void;
  onEdit: (event: ICalendarEvent) => void;
  onChanged: (event?: ICalendarEvent) => void;
}

const EventDetailModal: FC<Props> = ({ show, workspace, event, me, follows, onClose, onEdit, onChanged }) => {
  const [busy, setBusy] = useState(false);
  if (!event) {
    return null;
  }
  const base = `${calBase(workspace)}/events/${event.id}`;
  const isOwner = event.myStatus === 'owner';
  const canRsvp = event.myStatus === 'pending' || event.myStatus === 'accepted' || event.myStatus === 'declined';

  const rsvp = (status: RsvpStatus) => {
    setBusy(true);
    axios
      .put<ICalendarEvent>(`${base}/rsvp`, { status })
      .then((res) => {
        toast.success(status === 'accepted' ? '참석으로 답했습니다.' : '불참으로 답했습니다.', {
          position: 'bottom-center',
        });
        onChanged(res.data);
      })
      .catch(toastError)
      .finally(() => setBusy(false));
  };
  const remove = () => {
    if (!window.confirm(`'${event.title}' 일정을 지울까요? 참석자에게 취소를 알립니다.`)) {
      return;
    }
    axios
      .delete(base)
      .then(() => {
        toast.info('일정을 지웠습니다.', { position: 'bottom-center' });
        onClose();
        onChanged();
      })
      .catch(toastError);
  };

  const color = eventColor(event, me.id, follows);
  const reminder = REMINDERS.find(([v]) => v === (event.reminderMinutes ?? null))?.[1];
  return (
    <Modal
      show={show}
      onCloseModal={onClose}
      title={event.masked ? '바쁨' : event.title}
      description={event.masked ? '비공개 일정이라 자세한 내용은 볼 수 없습니다.' : undefined}
    >
      <Detail>
        <p className="when">
          <span
            style={{
              display: 'inline-block',
              width: 12,
              height: 12,
              borderRadius: 3,
              background: color,
              marginRight: 8,
            }}
          />
          🕒 {fmtWhen(event)}
        </p>
        {!event.masked && (
          <>
            {event.location && <p>📍 {event.location}</p>}
            {event.visibility === 'private' && <p>🔒 비공개 — 참석자 외에는 '바쁨' 으로만 보입니다.</p>}
            {reminder && event.reminderMinutes !== null && event.reminderMinutes !== undefined && (
              <p>⏰ {reminder} 알림</p>
            )}
            {event.description && <p className="desc">{event.description}</p>}
            <p>
              <b>주최</b> {event.Owner?.nickname || '(나간 사용자)'}
              {event.OwnerId === me.id && ' (나)'}
            </p>
            {event.Attendees.length > 1 && (
              <>
                <b style={{ fontSize: 14 }}>참석자 {event.Attendees.length}명</b>
                <ul>
                  {event.Attendees.map((a) => {
                    const status = a.UserId === event.OwnerId ? 'owner' : a.status;
                    return (
                      <li key={a.UserId}>
                        <img src={avatarUrl(a.User, 22)} alt="" />
                        <span>
                          {a.User.nickname}
                          {a.UserId === me.id && ' (나)'}
                        </span>
                        <small>
                          {STATUS_ICON[status]} {STATUS_LABEL[status]}
                        </small>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            {canRsvp && (
              <div className="rsvp" role="group" aria-label="참석 여부">
                <button
                  type="button"
                  className={event.myStatus === 'accepted' ? 'on' : undefined}
                  disabled={busy}
                  onClick={() => rsvp('accepted')}
                >
                  ✅ 참석
                </button>
                <button
                  type="button"
                  className={event.myStatus === 'declined' ? 'on' : undefined}
                  disabled={busy}
                  onClick={() => rsvp('declined')}
                >
                  ❌ 불참
                </button>
              </div>
            )}
          </>
        )}
        {isOwner && (
          <Actions>
            <button type="button" onClick={remove}>
              🗑 지우기
            </button>
            <button type="button" className="primary" onClick={() => onEdit(event)}>
              ✏️ 고치기
            </button>
          </Actions>
        )}
      </Detail>
    </Modal>
  );
};

export default EventDetailModal;
