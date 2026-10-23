import InviteWorkspaceModal from '@components/InviteWorkspaceModal';
import ProfileModal from '@components/ProfileModal';
import useGroups from '@hooks/useGroups';
import useOnlineList from '@hooks/useOnlineList';
import useSocket from '@hooks/useSocket';
import { IContact, IUser } from '@typings/db';
import { avatarUrl } from '@utils/avatar';
import fetcher from '@utils/fetcher';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import { Building2, Globe, Search, Star, UserPlus, Users } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import useSWR from 'swr';
import ContactDetail from './ContactDetail';
import ContactModal from './ContactModal';
import { InitialAvatar } from './InitialAvatar';
import { ContactsLayout, List, Main, Side } from './styles';

type View = 'members' | 'external' | 'starred' | 'groups';
const VIEWS: { key: View; label: string; Icon: typeof Users; color: string }[] = [
  { key: 'members', label: '기업 연락처', Icon: Building2, color: '#2f80ed' },
  { key: 'external', label: '외부 연락처', Icon: Globe, color: '#7c5cd6' },
  { key: 'starred', label: '별표 표시된 연락처', Icon: Star, color: '#e8891d' },
  { key: 'groups', label: '그룹', Icon: Users, color: '#12a06b' },
];

type Selected = { kind: 'member'; id: number } | { kind: 'external'; id: number } | null;

const showError = (error: unknown) => toast.error(getErrorMessage(error), { position: 'bottom-center' });
const byName = (a: string, b: string) => a.localeCompare(b, 'ko');
const memberMeta = (m: IUser) => [m.department, m.jobTitle].filter(Boolean).join(' · ');
const contactMeta = (c: IContact) => [c.company, c.department, c.jobTitle].filter(Boolean).join(' · ');

// 연락처: 워크스페이스 동료(기업 연락처), 내가 저장한 외부 연락처, 별표, 그룹
const Contacts = () => {
  const { workspace, view: viewParam } = useParams<{ workspace: string; view?: string }>();
  const view: View = VIEWS.some((v) => v.key === viewParam) ? (viewParam as View) : 'members';
  const history = useHistory();
  const { data: me, mutate: refreshMe } = useSWR<IUser>('/api/users', fetcher);
  const { data: members } = useSWR<IUser[]>(me ? `/api/workspaces/${workspace}/members` : null, fetcher);
  const base = `/api/workspaces/${workspace}/contacts`;
  const { data: contacts, mutate: refreshContacts } = useSWR<IContact[]>(me ? base : null, fetcher);
  const { data: stars, mutate: refreshStars } = useSWR<number[]>(me ? `${base}/stars` : null, fetcher);
  const followsKey = `/api/workspaces/${workspace}/calendar/follows`;
  const { data: follows, mutate: refreshFollows } = useSWR<IUser[]>(me ? followsKey : null, fetcher);
  const { data: groups } = useGroups(workspace);
  const onlineList = useOnlineList(workspace);
  const [socket] = useSocket(workspace);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Selected>(null);
  const [editing, setEditing] = useState<IContact | null | undefined>(undefined); // undefined: 닫힘, null: 새로
  const [showInvite, setShowInvite] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // 다른 기기에서 연락처·별표를 바꾸면 다시 불러온다
  useEffect(() => {
    const onChanged = () => {
      refreshContacts();
      refreshStars();
    };
    socket?.on('contactsChanged', onChanged);
    return () => {
      socket?.off('contactsChanged', onChanged);
    };
  }, [socket, refreshContacts, refreshStars]);

  useEffect(() => setQuery(''), [view]);

  const people = useMemo(
    () => (members || []).filter((m) => !m.bot).sort((a, b) => byName(a.nickname, b.nickname)),
    [members],
  );
  const external = useMemo(() => [...(contacts || [])].sort((a, b) => byName(a.name, b.name)), [contacts]);
  const starSet = useMemo(() => new Set(stars || []), [stars]);
  const followSet = useMemo(() => new Set((follows || []).map((f) => f.id)), [follows]);

  const keyword = query.trim().toLowerCase();
  const matchMember = useCallback(
    (m: IUser) =>
      !keyword ||
      [m.nickname, m.email, m.department, m.jobTitle, m.phone].some((v) => v?.toLowerCase().includes(keyword)),
    [keyword],
  );
  const matchContact = useCallback(
    (c: IContact) =>
      !keyword ||
      [c.name, c.company, c.department, c.jobTitle, c.email, c.phone, c.memo].some((v) =>
        v?.toLowerCase().includes(keyword),
      ),
    [keyword],
  );

  const toggleStar = (member: IUser) =>
    (starSet.has(member.id) ? axios.delete(`${base}/stars/${member.id}`) : axios.put(`${base}/stars/${member.id}`))
      .then(() => refreshStars())
      .catch(showError);
  const toggleContactStar = (contact: IContact) =>
    axios
      .patch(`${base}/${contact.id}`, { starred: !contact.starred })
      .then(() => refreshContacts())
      .catch(showError);
  const toggleFollow = (member: IUser) =>
    (followSet.has(member.id) ? axios.delete(`${followsKey}/${member.id}`) : axios.put(`${followsKey}/${member.id}`))
      .then(() => {
        refreshFollows();
        toast.success(
          followSet.has(member.id)
            ? `${member.nickname} 님의 캘린더 구독을 끊었습니다.`
            : `${member.nickname} 님의 캘린더를 구독했습니다. 캘린더에서 일정을 함께 볼 수 있어요.`,
          { position: 'bottom-center' },
        );
      })
      .catch(showError);

  if (!me) {
    return null;
  }
  const workspaceName = me.Workspaces?.find((w) => w.url === workspace)?.name || workspace;
  const current = VIEWS.find((v) => v.key === view)!;

  const memberRow = (m: IUser) => {
    const online = onlineList.includes(m.id);
    const meta = memberMeta(m);
    const starred = starSet.has(m.id);
    const active = selected?.kind === 'member' && selected.id === m.id;
    return (
      <li key={`m${m.id}`} className={active ? 'active' : undefined}>
        <button type="button" className="person" onClick={() => setSelected({ kind: 'member', id: m.id })}>
          <span className="avatar-wrap">
            <img src={avatarUrl(m, 80)} alt="" className="avatar" />
            <i className={`presence ${online && !m.away ? 'on' : online ? 'away' : 'off'}`} />
          </span>
          <span className="name">
            {m.nickname}
            {m.id === me.id && <small className="me"> (나)</small>}
            {m.role === 'guest' && <small className="role-tag">게스트</small>}
          </span>
          {meta && <span className="meta">{meta}</span>}
          {m.statusEmoji && (
            <span className="status" title={m.statusText || undefined}>
              {m.statusEmoji}
            </span>
          )}
        </button>
        {m.id !== me.id && (
          <button
            type="button"
            className={`star${starred ? ' on' : ''}`}
            onClick={() => toggleStar(m)}
            aria-pressed={starred}
            aria-label={`${m.nickname} 별표`}
            title={starred ? '별표 빼기' : '별표'}
          >
            <Star size={16} fill={starred ? 'currentColor' : 'none'} />
          </button>
        )}
      </li>
    );
  };
  const contactRow = (c: IContact) => {
    const meta = contactMeta(c);
    const active = selected?.kind === 'external' && selected.id === c.id;
    return (
      <li key={`c${c.id}`} className={active ? 'active' : undefined}>
        <button type="button" className="person" onClick={() => setSelected({ kind: 'external', id: c.id })}>
          <span className="avatar-wrap">
            <InitialAvatar name={c.name} size={40} />
          </span>
          <span className="name">{c.name}</span>
          {meta && <span className="meta">{meta}</span>}
        </button>
        <button
          type="button"
          className={`star${c.starred ? ' on' : ''}`}
          onClick={() => toggleContactStar(c)}
          aria-pressed={c.starred}
          aria-label={`${c.name} 별표`}
          title={c.starred ? '별표 빼기' : '별표'}
        >
          <Star size={16} fill={c.starred ? 'currentColor' : 'none'} />
        </button>
      </li>
    );
  };

  let body: React.ReactNode;
  let count = 0;
  if (view === 'members') {
    const list = people.filter(matchMember);
    count = list.length;
    body = (
      <section>
        <h3>{workspaceName}</h3>
        <ul>{list.map(memberRow)}</ul>
      </section>
    );
  } else if (view === 'external') {
    const list = external.filter(matchContact);
    count = list.length;
    body =
      external.length === 0 ? (
        <div className="empty">
          <Globe size={36} />
          <p>거래처, 고객처럼 워크스페이스 밖 사람의 연락처를 저장해 두세요.</p>
          <button type="button" className="primary" onClick={() => setEditing(null)}>
            <UserPlus size={15} /> 새 연락처
          </button>
        </div>
      ) : (
        <section>
          <h3>내가 저장한 연락처</h3>
          <ul>{list.map(contactRow)}</ul>
        </section>
      );
  } else if (view === 'starred') {
    const starredMembers = people.filter((m) => starSet.has(m.id) && matchMember(m));
    const starredContacts = external.filter((c) => c.starred && matchContact(c));
    count = starredMembers.length + starredContacts.length;
    body =
      count === 0 && !keyword ? (
        <div className="empty">
          <Star size={36} />
          <p>자주 연락하는 사람 옆의 별을 누르면 여기에 모입니다.</p>
        </div>
      ) : (
        <>
          {starredMembers.length > 0 && (
            <section>
              <h3>{workspaceName}</h3>
              <ul>{starredMembers.map(memberRow)}</ul>
            </section>
          )}
          {starredContacts.length > 0 && (
            <section>
              <h3>외부 연락처</h3>
              <ul>{starredContacts.map(contactRow)}</ul>
            </section>
          )}
        </>
      );
  } else {
    const list = (groups || []).map((g) => ({
      group: g,
      people: people.filter((m) => g.Members.some((gm) => gm.UserId === m.id) && matchMember(m)),
    }));
    count = new Set(list.flatMap((g) => g.people.map((p) => p.id))).size;
    body =
      (groups || []).length === 0 ? (
        <div className="empty">
          <Users size={36} />
          <p>아직 그룹이 없습니다. 메신저의 워크스페이스 메뉴 → 사용자 그룹에서 만들 수 있어요.</p>
        </div>
      ) : (
        list
          .filter((g) => g.people.length > 0 || !keyword)
          .map(({ group, people: groupPeople }) => (
            <section key={group.id}>
              <h3>
                @{group.name} <small>{group.Members.length}명</small>
                {group.description && <span className="desc">{group.description}</span>}
              </h3>
              <ul>{groupPeople.map(memberRow)}</ul>
            </section>
          ))
      );
  }

  const selectedMember = selected?.kind === 'member' ? people.find((m) => m.id === selected.id) : undefined;
  const selectedContact = selected?.kind === 'external' ? external.find((c) => c.id === selected.id) : undefined;

  return (
    <ContactsLayout>
      <Side aria-label="연락처 메뉴">
        <h1>연락처</h1>
        <div className="ws">
          <span className="ws-icon">{workspaceName.slice(0, 1).toUpperCase()}</span>
          <span className="ws-name">{workspaceName}</span>
        </div>
        <nav>
          {VIEWS.slice(0, 2).map((v) => (
            <button
              key={v.key}
              type="button"
              className={view === v.key ? 'on' : undefined}
              aria-current={view === v.key ? 'page' : undefined}
              onClick={() => history.push(`/workspace/${workspace}/contacts/${v.key}`)}
            >
              <v.Icon size={18} color={v.color} /> <span>{v.label}</span>
            </button>
          ))}
          <button type="button" onClick={() => setEditing(null)}>
            <UserPlus size={18} color="#2f80ed" /> <span>새 연락처</span>
          </button>
          {VIEWS.slice(2).map((v) => (
            <button
              key={v.key}
              type="button"
              className={view === v.key ? 'on' : undefined}
              aria-current={view === v.key ? 'page' : undefined}
              onClick={() => history.push(`/workspace/${workspace}/contacts/${v.key}`)}
            >
              <v.Icon size={18} color={v.color} /> <span>{v.label}</span>
            </button>
          ))}
        </nav>
      </Side>
      <Main className={selectedMember || selectedContact ? 'with-detail' : undefined}>
        <header>
          <h2>
            {current.label}
            <small>{count}명</small>
          </h2>
          <div className="search">
            <Search size={15} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름, 부서, 이메일, 전화번호로 찾기"
              aria-label="연락처 찾기"
            />
          </div>
          {view === 'members' && (
            <button type="button" className="add" onClick={() => setShowInvite(true)}>
              <UserPlus size={15} /> 구성원 초대
            </button>
          )}
          {view === 'external' && (
            <button type="button" className="add" onClick={() => setEditing(null)}>
              <UserPlus size={15} /> 새 연락처
            </button>
          )}
        </header>
        <div className="content">
          <List>
            {body}
            {keyword && count === 0 && <p className="no-result">‘{query.trim()}’ 에 맞는 연락처가 없습니다.</p>}
          </List>
          {selectedMember && (
            <ContactDetail
              kind="member"
              workspace={workspace}
              member={selectedMember}
              me={me}
              online={onlineList.includes(selectedMember.id)}
              starred={starSet.has(selectedMember.id)}
              following={followSet.has(selectedMember.id)}
              groups={groups || []}
              onToggleStar={() => toggleStar(selectedMember)}
              onToggleFollow={() => toggleFollow(selectedMember)}
              onEditProfile={() => setShowProfile(true)}
              onClose={() => setSelected(null)}
            />
          )}
          {selectedContact && (
            <ContactDetail
              kind="external"
              workspace={workspace}
              contact={selectedContact}
              onToggleStar={() => toggleContactStar(selectedContact)}
              onEdit={() => setEditing(selectedContact)}
              onDeleted={() => {
                setSelected(null);
                refreshContacts();
              }}
              onClose={() => setSelected(null)}
            />
          )}
        </div>
      </Main>
      <ContactModal
        show={editing !== undefined}
        workspace={workspace}
        contact={editing || null}
        onClose={() => setEditing(undefined)}
        onSaved={(saved) => {
          setEditing(undefined);
          refreshContacts();
          setSelected({ kind: 'external', id: saved.id });
          if (view !== 'external' && view !== 'starred') {
            history.push(`/workspace/${workspace}/contacts/external`);
          }
        }}
      />
      <InviteWorkspaceModal
        show={showInvite}
        onCloseModal={() => setShowInvite(false)}
        setShowInviteWorkspaceModal={setShowInvite}
      />
      <ProfileModal
        show={showProfile}
        me={me}
        onCloseModal={() => setShowProfile(false)}
        onUpdated={() => {
          refreshMe();
          setShowProfile(false);
        }}
      />
    </ContactsLayout>
  );
};

export default Contacts;
