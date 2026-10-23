import { ICalendarEvent, IUser } from '@typings/db';
import useMyRole from '@hooks/useMyRole';
import fetcher from '@utils/fetcher';
import axios from 'axios';
import dayjs, { Dayjs } from 'dayjs';
import { Bot, ChevronDown, ChevronLeft, ChevronRight, Plus, Search, UserPlus, X } from 'lucide-react';
import { avatarUrl } from '@utils/avatar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useHistory, useLocation, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import useSWR, { useSWRConfig } from 'swr';
import { calBase, toastError, useCalendarChanged } from './api';
import EventDetailModal from './EventDetailModal';
import EventModal, { EventDraft } from './EventModal';
import FollowModal from './FollowModal';
import MiniCalendar from './MiniCalendar';
import MonthView from './MonthView';
import { CalLayout, Main, Side, Toolbar } from './styles';
import TimeGrid from './TimeGrid';
import {
  calendarColorName,
  CalView,
  COLORS,
  fmtDay,
  rangeFor,
  readHidden,
  readView,
  saveHidden,
  saveView,
  startOfWeek,
} from './utils';

const VIEW_LABEL: Record<CalView, string> = { day: '일', week: '주', month: '월' };

// 캘린더: 내 일정 + 구독한 동료 일정. 일정 알림은 캘린더 어시스턴트가 DM 으로
const Calendar = () => {
  const { workspace } = useParams<{ workspace: string }>();
  // 게스트는 다른 사람의 캘린더를 구독할 수 없다
  const isGuest = useMyRole(workspace) === 'guest';
  const history = useHistory();
  const location = useLocation();
  const base = calBase(workspace);
  const { data: me } = useSWR<IUser>('/api/users', fetcher);
  const { data: members } = useSWR<IUser[]>(me ? `/api/workspaces/${workspace}/members` : null, fetcher);
  const { data: follows, mutate: refreshFollows } = useSWR<IUser[]>(me ? `${base}/follows` : null, fetcher);
  const { data: bot } = useSWR<{ id: number }>(me ? `${base}/bot` : null, fetcher);

  const [view, setView] = useState<CalView>(readView);
  const [cursor, setCursor] = useState(() => dayjs());
  // 끈 캘린더 (사용자 id)
  const [hidden, setHidden] = useState<Set<number>>(readHidden);
  const [closedGroups, setClosedGroups] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [detail, setDetail] = useState<ICalendarEvent | null>(null);
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [showFollow, setShowFollow] = useState(false);

  const followList = useMemo(() => follows || [], [follows]);
  const users = useMemo(
    () => (me ? [me.id, ...followList.map((f) => f.id)].filter((id) => !hidden.has(id)) : []),
    [me, followList, hidden],
  );
  const [from, to] = rangeFor(view, cursor);
  const key =
    me && users.length
      ? `${base}/events?from=${from.toISOString()}&to=${to.toISOString()}&users=${users.join(',')}`
      : null;
  const { data: events, mutate } = useSWR<ICalendarEvent[]>(key, fetcher);
  const { cache, mutate: mutateKey } = useSWRConfig();
  const detailId = detail?.id;
  // 일정이 바뀌면 지금 보는 기간뿐 아니라 캐시에 남은 다른 기간도 다시 불러오고, 열린 상세도 새로 읽는다
  const refresh = useCallback(
    (data?: { id?: number }) => {
      mutate();
      const keys = (cache as unknown as Map<string, unknown>).keys?.();
      if (keys) {
        Array.from(keys)
          .filter((k) => typeof k === 'string' && k.startsWith(`${base}/events?`) && k !== key)
          .forEach((k) => mutateKey(k));
      }
      if (data?.id && data.id === detailId) {
        axios
          .get<ICalendarEvent>(`${base}/events/${data.id}`)
          .then((res) =>
            setDetail((cur) => (cur && cur.id === res.data.id ? { ...res.data, calendars: cur.calendars } : cur)),
          )
          .catch(() => setDetail((cur) => (cur && cur.id === data.id ? null : cur)));
      }
    },
    [mutate, cache, mutateKey, base, key, detailId],
  );
  useCalendarChanged(workspace, refresh);

  // 알림 링크(?event=id)로 들어오면 그 일정을 연다
  const eventParam = new URLSearchParams(location.search).get('event');
  useEffect(() => {
    if (!eventParam || !me) {
      return;
    }
    axios
      .get<ICalendarEvent>(`${base}/events/${eventParam}`)
      .then((res) => {
        setCursor(dayjs(res.data.startAt));
        setDetail(res.data);
      })
      .catch(() => toast.error('일정을 찾을 수 없거나 볼 권한이 없습니다.', { position: 'bottom-center' }));
    history.replace(location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventParam, me]);

  // 다른 사람이 바꾸면 열어 둔 상세도 새로 읽는다
  useEffect(() => {
    if (detail && events) {
      const fresh = events.find((e) => e.id === detail.id);
      if (fresh && fresh !== detail) {
        setDetail(fresh);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  const changeView = (next: CalView) => {
    setView(next);
    saveView(next);
  };
  const move = (delta: number) =>
    setCursor((c) => c.add(delta, view === 'month' ? 'month' : view === 'week' ? 'week' : 'day'));

  if (!me) {
    return null;
  }
  const list = events || [];
  const marked = new Set(list.map((e) => dayjs(e.startAt).format('YYYY-MM-DD')));
  let title = cursor.format('YYYY년 M월');
  if (view === 'week') {
    const s = startOfWeek(cursor);
    const e = s.add(6, 'day');
    title = s.isSame(e, 'month')
      ? `${s.format('YYYY년 M월 D일')} – ${e.format('D일')}`
      : `${s.format('YYYY년 M월 D일')} – ${e.format('M월 D일')}`;
  } else if (view === 'day') {
    title = `${cursor.format('YYYY년')} ${fmtDay(cursor)}`;
  }
  const openDay = (day: Dayjs) => {
    setCursor(day);
    changeView('day');
  };
  const onSaved = (saved: ICalendarEvent) => {
    refresh();
    setCursor(dayjs(saved.startAt));
    if (detail && detail.id === saved.id) {
      setDetail(saved);
    }
  };
  const followIds = new Set(followList.map((f) => f.id));
  const keyword = query.trim().toLowerCase();
  const searchResults = (members || [])
    .filter(
      (m) =>
        m.id !== me.id &&
        !m.bot &&
        keyword &&
        (m.nickname.toLowerCase().includes(keyword) || m.email.toLowerCase().includes(keyword)),
    )
    .slice(0, 8);
  const toggleHidden = (id: number) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveHidden(next);
      return next;
    });
  const toggleGroup = (key: string) =>
    setClosedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  // 검색에서 고르면 구독하고, 이미 구독 중이면 꺼 둔 캘린더를 다시 켠다
  const follow = (user: IUser) => {
    setQuery('');
    setSearchOpen(false);
    if (hidden.has(user.id)) toggleHidden(user.id);
    if (followIds.has(user.id)) return;
    axios
      .put(`${base}/follows/${user.id}`)
      .then(() => {
        refreshFollows();
        toast.success(`${user.nickname} 님의 캘린더를 구독했습니다.`, { position: 'bottom-center' });
      })
      .catch(toastError);
  };

  return (
    <CalLayout>
      <Side aria-label="캘린더 목록">
        <button
          type="button"
          onClick={() => setDraft({})}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            width: '100%',
            height: 36,
            marginBottom: 14,
            border: 'none',
            borderRadius: 8,
            background: '#1264a3',
            color: 'white',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Plus size={16} /> 일정 만들기
        </button>
        <MiniCalendar cursor={cursor} marked={marked} onPick={(day) => setCursor(day)} />
        {!isGuest && (
          <div className="cal-search">
            <Search size={15} />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setQuery('');
                  (e.target as HTMLInputElement).blur();
                } else if (e.key === 'Enter' && searchResults[0]) {
                  follow(searchResults[0]);
                }
              }}
              placeholder="동료 캘린더 검색"
              aria-label="동료 캘린더 검색"
            />
            {searchOpen && query.trim() && (
              <ul className="results" role="listbox">
                {searchResults.length === 0 && <li className="empty">찾는 동료가 없습니다.</li>}
                {searchResults.map((m) => (
                  <li key={m.id}>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => follow(m)}>
                      <img src={avatarUrl(m, 24)} alt="" />
                      <span className="who">
                        {m.nickname}
                        <small>{m.email}</small>
                      </span>
                      {followIds.has(m.id) ? <span className="tag">구독 중</span> : <Plus size={14} />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {[
          { key: 'mine', label: '내 캘린더', users: [me] },
          ...(isGuest ? [] : [{ key: 'follow', label: '팔로잉', users: followList }]),
        ].map((group) => (
          <div key={group.key} className="cal-group">
            <h4>
              <button
                type="button"
                className="fold"
                aria-expanded={!closedGroups.has(group.key)}
                onClick={() => toggleGroup(group.key)}
              >
                <ChevronDown size={14} className={closedGroups.has(group.key) ? 'closed' : undefined} />
                {group.label}
              </button>
              {group.key === 'follow' && (
                <button type="button" onClick={() => setShowFollow(true)} title="동료 캘린더 구독">
                  <UserPlus size={13} /> 추가
                </button>
              )}
            </h4>
            {!closedGroups.has(group.key) &&
              group.users.map((user) => (
                <label
                  className="cal"
                  key={user.id}
                  style={{ ['--cal' as string]: COLORS[calendarColorName(user.id, me.id, followList)] }}
                >
                  <input type="checkbox" checked={!hidden.has(user.id)} onChange={() => toggleHidden(user.id)} />
                  <span className="name">{user.nickname}</span>
                  {user.id !== me.id && (
                    <button
                      type="button"
                      className="remove"
                      title="구독 끊기"
                      aria-label={`${user.nickname} 구독 끊기`}
                      onClick={(e) => {
                        e.preventDefault();
                        axios.delete(`${base}/follows/${user.id}`).then(() => refreshFollows());
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>
              ))}
            {!closedGroups.has(group.key) && group.key === 'follow' && followList.length === 0 && (
              <p className="cal-empty">위에서 동료를 찾아 구독하면 일정이 함께 보여요.</p>
            )}
          </div>
        ))}
        {bot && (
          <Link className="bot" to={`/workspace/${workspace}/dm/${bot.id}`} title="일정 알림이 오는 대화">
            <Bot size={16} /> 캘린더 어시스턴트
          </Link>
        )}
      </Side>
      <Main>
        <Toolbar>
          <button type="button" className="btn" onClick={() => setCursor(dayjs())}>
            오늘
          </button>
          <button type="button" className="btn" onClick={() => move(-1)} aria-label="이전">
            <ChevronLeft size={16} />
          </button>
          <button type="button" className="btn" onClick={() => move(1)} aria-label="다음">
            <ChevronRight size={16} />
          </button>
          <h2 className="title">{title}</h2>
          <div className="views" role="group" aria-label="보기">
            {(['day', 'week', 'month'] as CalView[]).map((v) => (
              <button
                key={v}
                type="button"
                className={view === v ? 'active' : undefined}
                onClick={() => changeView(v)}
                aria-pressed={view === v}
              >
                {VIEW_LABEL[v]}
              </button>
            ))}
          </div>
          <button type="button" className="btn primary" onClick={() => setDraft({})}>
            <Plus size={14} /> 일정
          </button>
        </Toolbar>
        {view === 'month' ? (
          <MonthView
            cursor={cursor}
            events={list}
            me={me.id}
            follows={followList}
            onOpen={setDetail}
            onCreate={(day) => setDraft({ start: day.hour(9), end: day.hour(10) })}
            onMore={openDay}
          />
        ) : (
          <TimeGrid
            days={
              view === 'week'
                ? Array.from({ length: 7 }, (_, i) => startOfWeek(cursor).add(i, 'day'))
                : [cursor.startOf('day')]
            }
            events={list}
            me={me.id}
            follows={followList}
            onOpen={setDetail}
            onCreate={(start, allDay) =>
              setDraft(allDay ? { start, end: start, allDay: true } : { start, end: start.add(1, 'hour') })
            }
          />
        )}
      </Main>
      <EventModal
        show={draft !== null}
        workspace={workspace}
        me={me}
        members={members || []}
        draft={draft}
        onClose={() => setDraft(null)}
        onSaved={onSaved}
      />
      <EventDetailModal
        show={detail !== null && draft === null}
        workspace={workspace}
        event={detail}
        me={me}
        follows={followList}
        onClose={() => setDetail(null)}
        onEdit={(event) => setDraft({ event })}
        onChanged={(event) => {
          refresh();
          if (event) setDetail(event);
        }}
      />
      <FollowModal
        show={showFollow}
        workspace={workspace}
        me={me}
        members={members || []}
        follows={followList}
        onClose={() => setShowFollow(false)}
        onChanged={() => refreshFollows()}
      />
    </CalLayout>
  );
};

export default Calendar;
