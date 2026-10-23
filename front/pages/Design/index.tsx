import useMyRole from '@hooks/useMyRole';
import DocPage from '@pages/Docs/DocPage';
import { IDocListItem, IUser } from '@typings/db';
import { avatarUrl } from '@utils/avatar';
import { DOC_TEMPLATES, DocTemplate } from '@utils/docTemplates';
import fetcher from '@utils/fetcher';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import dayjs from 'dayjs';
import { PenTool, Plus, Search } from 'lucide-react';
import React, { FC, useEffect, useState } from 'react';
import { Route, Switch, useHistory, useParams, useRouteMatch } from 'react-router-dom';
import { toast } from 'react-toastify';
import useSWR from 'swr';
import { FileCard, Home, TemplateCard } from './styles';

type Tab = 'recent' | 'mine' | 'shared' | 'all';
const TABS: { key: Tab; label: string }[] = [
  { key: 'recent', label: '최근' },
  { key: 'mine', label: '내 디자인' },
  { key: 'shared', label: '공유받은 디자인' },
  { key: 'all', label: '모두' },
];

// 템플릿 미리보기 그림 (실제 화면을 단순하게)
const Preview: FC<{ kind: string }> = ({ kind }) => {
  if (kind === 'design-mobile') {
    return (
      <svg viewBox="0 0 160 100" aria-hidden="true">
        <rect x="38" y="10" width="36" height="80" rx="5" fill="#fff" />
        <rect x="42" y="22" width="28" height="14" rx="3" fill="#6c5ce7" />
        <rect x="42" y="40" width="28" height="6" rx="2" fill="#e5e5ef" />
        <rect x="42" y="49" width="28" height="6" rx="2" fill="#e5e5ef" />
        <rect x="86" y="10" width="36" height="80" rx="5" fill="#fff" />
        <rect x="90" y="22" width="28" height="18" rx="3" fill="#e5e5ef" />
        <rect x="90" y="76" width="28" height="7" rx="2" fill="#6c5ce7" />
      </svg>
    );
  }
  if (kind === 'design-landing') {
    return (
      <svg viewBox="0 0 160 100" aria-hidden="true">
        <rect x="16" y="12" width="128" height="76" rx="4" fill="#fff" />
        <rect x="24" y="30" width="44" height="7" rx="2" fill="#1e1e1e" />
        <rect x="24" y="41" width="36" height="4" rx="2" fill="#bbb" />
        <rect x="24" y="50" width="22" height="7" rx="3.5" fill="#4f46e5" />
        <rect x="84" y="26" width="52" height="34" rx="5" fill="#eef0ff" />
        <rect x="24" y="66" width="34" height="16" rx="3" fill="#f2f2f4" />
        <rect x="63" y="66" width="34" height="16" rx="3" fill="#f2f2f4" />
        <rect x="102" y="66" width="34" height="16" rx="3" fill="#f2f2f4" />
      </svg>
    );
  }
  if (kind === 'design-dashboard') {
    return (
      <svg viewBox="0 0 160 100" aria-hidden="true">
        <rect x="16" y="12" width="128" height="76" rx="4" fill="#fafafa" />
        <rect x="16" y="12" width="26" height="76" fill="#fff" />
        <rect x="48" y="20" width="20" height="12" rx="2" fill="#fff" stroke="#e4e4e7" />
        <rect x="72" y="20" width="20" height="12" rx="2" fill="#fff" stroke="#e4e4e7" />
        <rect x="96" y="20" width="20" height="12" rx="2" fill="#fff" stroke="#e4e4e7" />
        <rect x="48" y="38" width="56" height="30" rx="2" fill="#fff" stroke="#e4e4e7" />
        <rect x="56" y="54" width="6" height="10" fill="#c7d2fe" />
        <rect x="66" y="48" width="6" height="16" fill="#6366f1" />
        <rect x="76" y="52" width="6" height="12" fill="#c7d2fe" />
        <rect x="108" y="38" width="28" height="30" rx="2" fill="#fff" stroke="#e4e4e7" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 160 100" aria-hidden="true">
      <rect x="54" y="20" width="52" height="60" rx="4" fill="#fff" stroke="#d4d4d8" strokeDasharray="4 3" />
      <path d="M80 42v16M72 50h16" stroke="#a259ff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
};

// 디자인 메뉴 첫 화면: Figma 처럼 새 디자인·템플릿과 디자인 파일 목록
const DesignHome: FC<{ me: IUser }> = ({ me }) => {
  const { workspace } = useParams<{ workspace: string }>();
  const history = useHistory();
  const isGuest = useMyRole(workspace) === 'guest';
  const [tab, setTab] = useState<Tab>('recent');
  const [query, setQuery] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setQ(query.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [query]);
  const { data: files } = useSWR<IDocListItem[]>(
    `/api/workspaces/${workspace}/docs?type=design&tab=${q ? 'all' : tab}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    fetcher,
  );
  const templates = DOC_TEMPLATES.filter((t) => t.type === 'design');

  const create = (template?: DocTemplate) =>
    axios
      .post<{ id: number }>(`/api/workspaces/${workspace}/docs`, {
        type: 'design',
        title: template ? template.title() : '제목 없는 디자인',
        content: template ? template.content() : '',
      })
      .then(({ data }) => history.push(`/workspace/${workspace}/design/d/${data.id}`))
      .catch((err) => toast.error(getErrorMessage(err), { position: 'bottom-center' }));

  return (
    <Home>
      <header>
        <h2>
          <PenTool size={20} color="#a259ff" /> 디자인
        </h2>
        <label className="search">
          <Search size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="디자인 파일 찾기"
            aria-label="디자인 파일 찾기"
          />
        </label>
        <button type="button" className="primary" onClick={() => create()}>
          <Plus size={15} /> 새 디자인
        </button>
      </header>

      <section aria-label="새로 시작하기">
        <h3>새로 시작하기</h3>
        <div className="templates">
          <TemplateCard type="button" onClick={() => create()}>
            <Preview kind="blank" />
            <b>빈 디자인</b>
            <small>빈 캔버스에서 시작</small>
          </TemplateCard>
          {templates.map((t) => (
            <TemplateCard key={t.key} type="button" onClick={() => create(t)}>
              <Preview kind={t.key} />
              <b>{t.name}</b>
              <small>{t.description}</small>
            </TemplateCard>
          ))}
        </div>
      </section>

      <section aria-label="디자인 파일">
        {!q && (
          <div className="tabs" role="tablist">
            {TABS.filter((t) => !isGuest || t.key !== 'all').map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                className={tab === t.key ? 'on' : undefined}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        {q && <h3>"{q}" 찾은 결과</h3>}
        {files && !files.length && (
          <p className="empty">
            {q ? '찾는 디자인이 없어요.' : '아직 디자인 파일이 없어요. 위에서 새 디자인이나 템플릿으로 시작해 보세요.'}
          </p>
        )}
        <div className="files">
          {(files || []).map((f) => (
            <FileCard
              key={f.id}
              type="button"
              onClick={() => history.push(`/workspace/${workspace}/design/d/${f.id}`)}
              aria-label={f.title}
            >
              <span className="thumb">
                <PenTool size={28} />
              </span>
              <span className="info">
                <b>{f.title}</b>
                <small>
                  {f.ownerName && (
                    <img src={avatarUrl({ email: f.ownerEmail || '', avatarStyle: f.ownerAvatarStyle }, 32)} alt="" />
                  )}
                  {f.ownerId === me.id ? '나' : f.ownerName} · {dayjs(f.updatedAt).format('M월 D일 HH:mm')} 고침
                </small>
              </span>
            </FileCard>
          ))}
        </div>
      </section>
    </Home>
  );
};

// 왼쪽 메뉴 "디자인": 첫 화면과, 디자인 파일 열기 (Docs 목록 없이 넓게)
const Design: FC = () => {
  const { path } = useRouteMatch();
  const { data: me } = useSWR<IUser>('/api/users', fetcher);
  if (!me) return null;
  return (
    <Switch>
      <Route exact path={path} render={() => <DesignHome me={me} />} />
      <Route path={`${path}/d/:docId`} render={() => <DocPage me={me} area="design" />} />
    </Switch>
  );
};

export default Design;
