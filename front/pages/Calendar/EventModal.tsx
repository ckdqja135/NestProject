import Modal from '@components/Modal';
import { Actions, Field, FormError, TextInput } from '@components/ModalForm/styles';
import { ICalendarEvent, IUser } from '@typings/db';
import { avatarUrl } from '@utils/avatar';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import dayjs, { Dayjs } from 'dayjs';
import { Lock } from 'lucide-react';
import React, { FC, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { calBase } from './api';
import { PeopleList, Row, Swatches } from './styles';
import { COLOR_NAMES, COLORS, REMINDERS, toDateInput, toInput } from './utils';

export interface EventDraft {
  event?: ICalendarEvent; // 있으면 고치기
  start?: Dayjs;
  end?: Dayjs;
  allDay?: boolean;
  // 메시지로 일정을 만들 때 미리 채울 값
  title?: string;
  description?: string;
  attendeeIds?: number[];
}

interface Props {
  show: boolean;
  workspace: string;
  me: IUser;
  members: IUser[];
  draft: EventDraft | null;
  onClose: () => void;
  onSaved: (event: ICalendarEvent) => void;
}

const EventModal: FC<Props> = ({ show, workspace, me, members, draft, onClose, onSaved }) => {
  const editing = draft?.event;
  const [title, setTitle] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState(dayjs());
  const [end, setEnd] = useState(dayjs());
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [attendeeIds, setAttendeeIds] = useState<number[]>([]);
  const [reminder, setReminder] = useState<number | null>(10);
  const [color, setColor] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!show) {
      return;
    }
    setError('');
    setQuery('');
    if (editing) {
      setTitle(editing.title);
      setAllDay(editing.allDay);
      setStart(dayjs(editing.startAt));
      setEnd(editing.allDay ? dayjs(editing.endAt).subtract(1, 'day') : dayjs(editing.endAt));
      setLocation(editing.location || '');
      setDescription(editing.description || '');
      setAttendeeIds(editing.Attendees.filter((a) => a.UserId !== me.id).map((a) => a.UserId));
      setReminder(editing.reminderMinutes ?? null);
      setColor(editing.color);
      setVisibility(editing.visibility);
    } else {
      const s = draft?.start || dayjs().add(1, 'hour').startOf('hour');
      setTitle(draft?.title || '');
      setAllDay(!!draft?.allDay);
      setStart(s);
      setEnd(draft?.end || (draft?.allDay ? s : s.add(1, 'hour')));
      setLocation('');
      setDescription(draft?.description || '');
      setAttendeeIds((draft?.attendeeIds || []).filter((id) => id !== me.id));
      setReminder(10);
      setColor(null);
      setVisibility('public');
    }
  }, [show, draft, editing, me.id]);

  const changeStart = (value: string) => {
    const next = dayjs(value);
    if (!next.isValid()) {
      return;
    }
    // 시작을 옮기면 길이는 그대로
    setEnd(end.add(next.diff(start)));
    setStart(next);
  };
  const toggleAllDay = (on: boolean) => {
    setAllDay(on);
    if (on) {
      setStart(start.startOf('day'));
      setEnd(end.startOf('day').isBefore(start.startOf('day')) ? start.startOf('day') : end.startOf('day'));
    } else {
      const s = start.hour(9).minute(0);
      setStart(s);
      setEnd(s.add(1, 'hour'));
    }
  };

  const keyword = query.trim().toLowerCase();
  const people = members.filter(
    (m) =>
      m.id !== me.id &&
      !m.bot &&
      (!keyword || m.nickname.toLowerCase().includes(keyword) || m.email.toLowerCase().includes(keyword)),
  );
  const toggleAttendee = (id: number) =>
    setAttendeeIds((ids) => (ids.includes(id) ? ids.filter((v) => v !== id) : [...ids, id]));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('제목을 입력해 주세요.');
      return;
    }
    const startAt = allDay ? start.startOf('day') : start;
    const endAt = allDay ? end.startOf('day').add(1, 'day') : end;
    if (!endAt.isAfter(startAt)) {
      setError(allDay ? '끝나는 날은 시작하는 날보다 앞설 수 없습니다.' : '끝나는 시각은 시작 시각보다 뒤여야 합니다.');
      return;
    }
    const body = {
      title: title.trim(),
      allDay,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      location: location.trim(),
      description: description.trim(),
      attendeeIds,
      reminderMinutes: reminder,
      color,
      visibility,
    };
    const base = `${calBase(workspace)}/events`;
    setSaving(true);
    (editing ? axios.patch<ICalendarEvent>(`${base}/${editing.id}`, body) : axios.post<ICalendarEvent>(base, body))
      .then((res) => {
        toast.success(
          editing
            ? '일정을 고쳤습니다.'
            : attendeeIds.length
            ? `일정을 만들고 ${attendeeIds.length}명에게 초대를 보냈습니다.`
            : '일정을 만들었습니다.',
          { position: 'bottom-center' },
        );
        onSaved(res.data);
        onClose();
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setSaving(false));
  };

  return (
    <Modal show={show} onCloseModal={onClose} title={editing ? '일정 고치기' : '새 일정'}>
      <form onSubmit={onSubmit}>
        {error && <FormError role="alert">{error}</FormError>}
        <Field>
          <label htmlFor="ev-title">제목</label>
          <TextInput
            id="ev-title"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 주간 회의"
          />
        </Field>
        <Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={allDay} onChange={(e) => toggleAllDay(e.target.checked)} />
            종일
          </label>
        </Field>
        <Row>
          <Field>
            <label htmlFor="ev-start">시작</label>
            <TextInput
              id="ev-start"
              type={allDay ? 'date' : 'datetime-local'}
              value={allDay ? toDateInput(start) : toInput(start)}
              onChange={(e) => changeStart(e.target.value)}
            />
          </Field>
          <Field>
            <label htmlFor="ev-end">{allDay ? '끝나는 날' : '끝'}</label>
            <TextInput
              id="ev-end"
              type={allDay ? 'date' : 'datetime-local'}
              value={allDay ? toDateInput(end) : toInput(end)}
              onChange={(e) => {
                const next = dayjs(e.target.value);
                if (next.isValid()) setEnd(next);
              }}
            />
          </Field>
        </Row>
        <Row>
          <Field>
            <label htmlFor="ev-location">장소</label>
            <TextInput
              id="ev-location"
              value={location}
              maxLength={120}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="예: 3층 회의실, 화상 회의 링크"
            />
          </Field>
          <Field>
            <label htmlFor="ev-reminder">알림</label>
            <TextInput
              as="select"
              id="ev-reminder"
              value={reminder === null ? '' : String(reminder)}
              onChange={(e) => setReminder(e.target.value === '' ? null : Number(e.target.value))}
            >
              {REMINDERS.map(([value, label]) => (
                <option key={label} value={value === null ? '' : value}>
                  {label}
                </option>
              ))}
            </TextInput>
            <p className="hint">슐랙봇이 DM 으로 알려 드려요. 접속해 있지 않으면 이메일로도.</p>
          </Field>
        </Row>
        <Field>
          <label htmlFor="ev-people">참석자 {attendeeIds.length > 0 && `(${attendeeIds.length}명)`}</label>
          <TextInput
            id="ev-people"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이름이나 이메일로 찾기"
            autoComplete="off"
          />
          <PeopleList style={{ marginTop: 6 }}>
            {people.length === 0 && <p>초대할 수 있는 사람이 없습니다.</p>}
            {people.map((m) => (
              <label key={m.id}>
                <input type="checkbox" checked={attendeeIds.includes(m.id)} onChange={() => toggleAttendee(m.id)} />
                <img src={avatarUrl(m, 24)} alt="" />
                <span className="who">
                  {m.nickname}
                  <small>{m.email}</small>
                </span>
              </label>
            ))}
          </PeopleList>
          {!editing && attendeeIds.length > 0 && (
            <p className="hint">만들면 슐랙봇이 참석자에게 초대 DM 을 보냅니다.</p>
          )}
        </Field>
        <Field>
          <label htmlFor="ev-desc">설명</label>
          <TextInput
            as="textarea"
            id="ev-desc"
            value={description}
            maxLength={2000}
            onChange={(e) => setDescription(e.target.value)}
            style={{ height: 70, padding: 8, resize: 'vertical' }}
          />
        </Field>
        <Row>
          <Field>
            <label>색</label>
            <Swatches role="radiogroup" aria-label="일정 색">
              <button
                type="button"
                className={`none${color === null ? ' on' : ''}`}
                onClick={() => setColor(null)}
                title="캘린더 색 그대로"
                aria-pressed={color === null}
              >
                자동
              </button>
              {COLOR_NAMES.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={color === name ? 'on' : undefined}
                  style={{ background: COLORS[name] }}
                  onClick={() => setColor(name)}
                  aria-label={name}
                  aria-pressed={color === name}
                />
              ))}
            </Swatches>
          </Field>
          <Field>
            <label>공개 범위</label>
            <label style={{ display: 'flex', gap: 6, fontWeight: 400, fontSize: 14 }}>
              <input
                type="radio"
                name="ev-vis"
                checked={visibility === 'public'}
                onChange={() => setVisibility('public')}
              />
              공개 (동료가 제목을 볼 수 있음)
            </label>
            <label style={{ display: 'flex', gap: 6, fontWeight: 400, fontSize: 14 }}>
              <input
                type="radio"
                name="ev-vis"
                checked={visibility === 'private'}
                onChange={() => setVisibility('private')}
              />
              <Lock size={13} style={{ marginTop: 2 }} /> 비공개 (참석자 외에는 '바쁨' 으로만)
            </label>
          </Field>
        </Row>
        <Actions>
          <button type="button" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="primary" disabled={saving}>
            {editing ? '저장' : '만들기'}
          </button>
        </Actions>
      </form>
    </Modal>
  );
};

export default EventModal;
