import { IDocFolder, IDocListItem, IUser } from '@typings/db';
import { avatarUrl } from '@utils/avatar';
import { DOC_TEMPLATES, DOC_TYPE_INFO } from '@utils/docTemplates';
import fetcher from '@utils/fetcher';
import axios from 'axios';
import dayjs from 'dayjs';
import React, { FC, useCallback, useEffect, useState } from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import useSWR, { mutate as mutateKey } from 'swr';
import { createDoc, docPath, docsBase, toastError, useDocsChanged } from './api';
import FolderModal from './FolderModal';
import { Cards, DocGrid, DocTable, DropMenu, Empty, HomeWrap, RowMenuButton, Tabs } from './styles';

export type HomeMode = 'home' | 'mine' | 'folder' | 'trash' | 'wiki';

const TABS = [
  { key: 'recent', label: '최근' },
  { key: 'mine', label: '내 소유' },
  { key: 'shared', label: '나와 공유한 파일' },
  { key: 'favorites', label: '즐겨찾기' },
] as const;

const VIEW_KEY = 'shlack-docs-view';
const readView = () => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'list';
  } catch {
    return 'list';
  }
};

const formatTime = (value: string | null) => {
  if (!value) {
    return '—';
  }
  const time = dayjs(value);
  if (time.isSame(dayjs(), 'day')) {
    return `오늘 ${time.format('HH:mm')}`;
  }
  return time.isSame(dayjs(), 'year') ? time.format('M월 D일 HH:mm') : time.format('YYYY년 M월 D일');
};

// 바깥을 누르면 닫히는 드롭다운
const useDropdown = () => {
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const close = () => setOpen(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);
  const toggle = (key: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((v) => (v === key ? null : key));
  };
  return { open, toggle, close: () => setOpen(null) };
};

// 홈 위쪽 카드. 펼침 메뉴는 버튼의 형제로 둔다 (button 안에 button 은 둘 수 없다)
const Card: FC<{
  icon: string;
  title: string;
  hint: string;
  onClick: (e: React.MouseEvent) => void;
  menu?: React.ReactNode;
}> = ({ icon, title, hint, onClick, menu }) => (
  <div className="card">
    <button type="button" onClick={onClick} aria-haspopup={menu !== undefined ? 'menu' : undefined}>
      <span className="icon">{icon}</span>
      <span>
        <strong>{title}</strong>
        <small>{hint}</small>
      </span>
    </button>
    {menu}
  </div>
);

interface Props {
  mode: HomeMode;
  me: IUser;
}

const DocsHome: FC<Props> = ({ mode, me }) => {
  const { workspace, folderId: folderParam } = useParams<{ workspace: string; folderId?: string }>();
  const history = useHistory();
  const location = useLocation();
  const q = new URLSearchParams(location.search).get('q')?.trim() || '';
  const folderId = folderParam ? Number(folderParam) : undefined;
  const base = docsBase(workspace);
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('recent');
  const [view, setView] = useState<'list' | 'grid'>(readView);
  const dropdown = useDropdown();
  const [folderModal, setFolderModal] = useState<'new' | 'rename' | null>(null);

  let query: string;
  if (mode === 'home') {
    query = q ? `tab=all&q=${encodeURIComponent(q)}` : `tab=${tab}`;
  } else if (mode === 'folder') {
    query = `tab=folder&folderId=${folderId}`;
  } else if (mode === 'wiki') {
    query = 'tab=all';
  } else {
    query = `tab=${mode}`;
  }
  const { data: rows, mutate } = useSWR<IDocListItem[]>(`${base}/docs?${query}`, fetcher);
  const { data: folders, mutate: refreshFolders } = useSWR<IDocFolder[]>(`${base}/doc-folders`, fetcher);
  const refresh = useCallback(() => {
    mutate();
    refreshFolders();
  }, [mutate, refreshFolders]);
  useDocsChanged(workspace, refresh);

  const folder = folders?.find((f) => f.id === folderId);
  const subFolders = mode === 'folder' ? folders?.filter((f) => f.ParentId === folderId) || [] : [];
  const docs = mode === 'wiki' ? rows?.filter((r) => r.type === 'wiki') : rows;
  const go = (path: string) => history.push(path);

  const changeView = (next: 'list' | 'grid') => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // 저장하지 못해도 이번 화면에서는 바뀐다
    }
  };

  const newDoc = (type: 'doc' | 'wiki' | 'slides', title?: string, content?: string) =>
    createDoc(workspace, { type, title, content, folderId: type !== 'wiki' ? folderId : undefined }, go);

  const toggleFavorite = (doc: IDocListItem) =>
    (doc.favorite ? axios.delete(`${base}/docs/${doc.id}/favorite`) : axios.put(`${base}/docs/${doc.id}/favorite`))
      .then(() => {
        refresh();
        mutateKey(`${base}/docs?tab=favorites`);
      })
      .catch(toastError);
  const trash = (doc: IDocListItem) =>
    axios
      .delete(`${base}/docs/${doc.id}`)
      .then(() => {
        toast.info(`'${doc.title}' 을(를) 휴지통으로 옮겼습니다.`, { position: 'bottom-center' });
        refresh();
      })
      .catch(toastError);
  const restore = (doc: IDocListItem) =>
    axios
      .post(`${base}/docs/${doc.id}/restore`)
      .then(() => {
        toast.success(`'${doc.title}' 을(를) 되살렸습니다.`, { position: 'bottom-center' });
        refresh();
      })
      .catch(toastError);
  const removeForever = (doc: IDocListItem) => {
    if (!window.confirm(`'${doc.title}' 을(를) 완전히 지울까요? 되돌릴 수 없습니다.`)) {
      return;
    }
    axios.delete(`${base}/docs/${doc.id}/permanent`).then(refresh).catch(toastError);
  };
  const deleteFolder = () => {
    if (!folder || !window.confirm(`'${folder.name}' 폴더를 지울까요? 안의 문서는 내 문서 라이브러리로 나옵니다.`)) {
      return;
    }
    axios
      .delete(`${base}/doc-folders/${folder.id}`)
      .then(() => {
        refreshFolders();
        go(
          folder.ParentId
            ? `/workspace/${workspace}/docs/folder/${folder.ParentId}`
            : `/workspace/${workspace}/docs/mine`,
        );
      })
      .catch(toastError);
  };

  const location_ = (doc: IDocListItem) => {
    if (doc.type === 'wiki') {
      return 'Wiki';
    }
    return doc.folderName ? `📁 ${doc.folderName}` : doc.ownerId === me.id ? '내 문서' : '—';
  };

  const open = (doc: IDocListItem) => mode !== 'trash' && go(docPath(workspace, doc.id));

  let heading = '홈';
  if (mode === 'home' && q) {
    heading = `'${q}' 검색 결과`;
  } else if (mode === 'mine') {
    heading = '내 문서 전체';
  } else if (mode === 'folder') {
    heading = folder ? `📁 ${folder.name}` : '폴더';
  } else if (mode === 'trash') {
    heading = '🗑 휴지통';
  } else if (mode === 'wiki') {
    heading = '📚 Wiki';
  }

  // 폴더 경로 (상위 폴더 → 현재)
  const crumbs: IDocFolder[] = [];
  for (let cursor = folder; cursor; cursor = folders?.find((f) => f.id === cursor?.ParentId)) {
    crumbs.unshift(cursor);
    if (crumbs.length > 20) {
      break;
    }
  }

  const rowMenu = (doc: IDocListItem) => {
    const key = `row-${doc.id}`;
    return (
      <span style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
        <RowMenuButton
          type="button"
          onClick={dropdown.toggle(key)}
          aria-label={`${doc.title} 메뉴`}
          aria-haspopup="menu"
        >
          ⋯
        </RowMenuButton>
        {dropdown.open === key && (
          <DropMenu role="menu" style={{ left: 'auto', right: 0, minWidth: 180 }}>
            {mode === 'trash' ? (
              <>
                <button type="button" role="menuitem" onClick={() => restore(doc)}>
                  ↩ 되살리기
                </button>
                <button type="button" role="menuitem" onClick={() => removeForever(doc)}>
                  ✖ 완전히 지우기
                </button>
              </>
            ) : (
              <>
                <button type="button" role="menuitem" onClick={() => toggleFavorite(doc)}>
                  {doc.favorite ? '★ 고정 해제' : '☆ 고정하기'}
                </button>
                {doc.ownerId === me.id && (
                  <button type="button" role="menuitem" onClick={() => trash(doc)}>
                    🗑 휴지통으로 옮기기
                  </button>
                )}
              </>
            )}
          </DropMenu>
        )}
      </span>
    );
  };

  const emptyText = () => {
    if (q) {
      return '제목이 맞는 문서가 없습니다.';
    }
    if (mode === 'trash') {
      return '휴지통이 비어 있습니다.';
    }
    if (mode === 'folder') {
      return subFolders.length ? '' : '이 폴더는 비어 있습니다.';
    }
    if (mode === 'wiki') {
      return '아직 위키 페이지가 없습니다. 위에서 첫 페이지를 만들어 보세요.';
    }
    return {
      recent: '최근에 연 문서가 없습니다.',
      mine: '아직 만든 문서가 없습니다.',
      shared: '나와 공유한 문서가 없습니다.',
      favorites: '고정한 문서가 없습니다.',
    }[mode === 'mine' ? 'mine' : tab];
  };

  return (
    <HomeWrap>
      {mode === 'folder' && crumbs.length > 1 && (
        <div style={{ marginBottom: 4, fontSize: 13, color: 'var(--text-muted)' }}>
          {crumbs.slice(0, -1).map((c) => (
            <span key={c.id}>
              <a
                href={`/workspace/${workspace}/docs/folder/${c.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  go(`/workspace/${workspace}/docs/folder/${c.id}`);
                }}
              >
                {c.name}
              </a>{' '}
              ›{' '}
            </span>
          ))}
        </div>
      )}
      <h2>{heading}</h2>

      {mode !== 'trash' && !q && (
        <Cards>
          {mode === 'wiki' ? (
            <Card
              icon="📚"
              title="새 위키 페이지"
              hint="워크스페이스 모두가 보고 고칠 수 있습니다"
              onClick={() => newDoc('wiki')}
            />
          ) : (
            <Card
              icon="➕"
              title="새로 만들기"
              hint="문서 · 슬라이드 · 위키"
              onClick={dropdown.toggle('new')}
              menu={
                dropdown.open === 'new' && (
                  <DropMenu role="menu">
                    {(Object.keys(DOC_TYPE_INFO) as (keyof typeof DOC_TYPE_INFO)[]).map((type) => (
                      <button type="button" role="menuitem" key={type} onClick={() => newDoc(type)}>
                        <span>{DOC_TYPE_INFO[type].icon}</span>
                        <span>
                          {DOC_TYPE_INFO[type].label}
                          <small>{DOC_TYPE_INFO[type].description}</small>
                        </span>
                      </button>
                    ))}
                  </DropMenu>
                )
              }
            />
          )}
          <Card
            icon="🧩"
            title="템플릿"
            hint="회의록, 주간 보고, 발표 자료…"
            onClick={dropdown.toggle('template')}
            menu={
              dropdown.open === 'template' && (
                <DropMenu role="menu">
                  {DOC_TEMPLATES.filter((t) => (mode === 'wiki' ? t.type === 'wiki' : true)).map((t) => (
                    <button
                      type="button"
                      role="menuitem"
                      key={t.key}
                      onClick={() => newDoc(t.type, t.title(), t.content())}
                    >
                      <span>{t.icon}</span>
                      <span>
                        {t.name}
                        <small>{t.description}</small>
                      </span>
                    </button>
                  ))}
                </DropMenu>
              )
            }
          />
          {mode !== 'wiki' && (
            <Card
              icon="📁"
              title="새 폴더"
              hint={folder ? `'${folder.name}' 안에 만들기` : '내 문서 라이브러리에 만들기'}
              onClick={() => setFolderModal('new')}
            />
          )}
          {mode === 'folder' && folder && (
            <Card
              icon="⚙️"
              title="폴더 관리"
              hint="이름 바꾸기 · 지우기"
              onClick={dropdown.toggle('folder')}
              menu={
                dropdown.open === 'folder' && (
                  <DropMenu role="menu">
                    <button type="button" role="menuitem" onClick={() => setFolderModal('rename')}>
                      ✏️ 이름 바꾸기
                    </button>
                    <button type="button" role="menuitem" onClick={deleteFolder}>
                      🗑 폴더 지우기
                    </button>
                  </DropMenu>
                )
              }
            />
          )}
        </Cards>
      )}

      <Tabs>
        {mode === 'home' && !q && (
          <div className="tablist" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                className={`tab${tab === t.key ? ' active' : ''}`}
                onClick={() => setTab(t.key)}
                aria-selected={tab === t.key}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        <div className="tools">
          <button
            type="button"
            className={view === 'list' ? 'active' : undefined}
            onClick={() => changeView('list')}
            aria-label="목록으로 보기"
            title="목록"
          >
            ☰
          </button>
          <button
            type="button"
            className={view === 'grid' ? 'active' : undefined}
            onClick={() => changeView('grid')}
            aria-label="격자로 보기"
            title="격자"
          >
            ▦
          </button>
        </div>
      </Tabs>

      {mode === 'trash' && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>휴지통에는 내가 만든 문서만 보입니다.</p>
      )}

      {!docs ? null : docs.length === 0 && subFolders.length === 0 ? (
        <Empty>{emptyText()}</Empty>
      ) : view === 'grid' ? (
        <DocGrid>
          {subFolders.map((f) => (
            <button type="button" key={`f${f.id}`} onClick={() => go(`/workspace/${workspace}/docs/folder/${f.id}`)}>
              <span className="icon">📁</span>
              <strong>{f.name}</strong>
              <small>폴더</small>
            </button>
          ))}
          {docs.map((doc) => (
            <button type="button" key={doc.id} onClick={() => open(doc)} title={doc.title}>
              <span className="icon">{DOC_TYPE_INFO[doc.type].icon}</span>
              <strong>
                {doc.favorite ? '★ ' : ''}
                {doc.title}
              </strong>
              <small>
                {doc.ownerName} · {formatTime(doc.updatedAt)}
              </small>
            </button>
          ))}
        </DocGrid>
      ) : (
        <DocTable>
          <thead>
            <tr>
              <th>이름</th>
              <th className="hide-mobile">위치</th>
              <th className="hide-mobile">소유자</th>
              <th className="hide-mobile">생성 시간</th>
              <th>
                {mode === 'trash' ? '지운 시간' : tab === 'recent' && mode === 'home' && !q ? '최근 열람' : '최근 수정'}
              </th>
              <th aria-label="메뉴" />
            </tr>
          </thead>
          <tbody>
            {subFolders.map((f) => (
              <tr key={`f${f.id}`} onClick={() => go(`/workspace/${workspace}/docs/folder/${f.id}`)}>
                <td>
                  <span className="name">📁 {f.name}</span>
                </td>
                <td className="hide-mobile muted">{folder?.name}</td>
                <td className="hide-mobile muted">나</td>
                <td className="hide-mobile muted">—</td>
                <td className="muted">—</td>
                <td />
              </tr>
            ))}
            {docs.map((doc) => (
              <tr key={doc.id} onClick={() => open(doc)}>
                <td title={doc.title}>
                  <span className="name">
                    {DOC_TYPE_INFO[doc.type].icon} {doc.title}
                    {doc.favorite && <span aria-label="고정됨">★</span>}
                    {doc.visibility === 'private' && doc.type !== 'wiki' && (
                      <span className="muted" title="나와 공유한 사람만 볼 수 있습니다">
                        🔒
                      </span>
                    )}
                  </span>
                </td>
                <td className="hide-mobile muted">{location_(doc)}</td>
                <td className="hide-mobile">
                  <span className="owner">
                    {doc.ownerEmail && (
                      <img src={avatarUrl({ email: doc.ownerEmail, avatarStyle: doc.ownerAvatarStyle }, 20)} alt="" />
                    )}
                    {doc.ownerId === me.id ? '나' : doc.ownerName || '(나간 사용자)'}
                  </span>
                </td>
                <td className="hide-mobile muted">{formatTime(doc.createdAt)}</td>
                <td className="muted">
                  {formatTime(
                    mode === 'trash'
                      ? doc.deletedAt
                      : tab === 'recent' && mode === 'home' && !q
                      ? doc.viewedAt
                      : doc.updatedAt,
                  )}
                </td>
                <td>{rowMenu(doc)}</td>
              </tr>
            ))}
          </tbody>
        </DocTable>
      )}
      <FolderModal
        show={!!folderModal}
        workspace={workspace}
        folder={folderModal === 'rename' ? folder : undefined}
        parentId={folderModal === 'new' ? folderId : undefined}
        onCloseModal={() => setFolderModal(null)}
        onDone={(f) => {
          refreshFolders();
          if (folderModal === 'new') {
            go(`/workspace/${workspace}/docs/folder/${f.id}`);
          }
        }}
      />
    </HomeWrap>
  );
};

export default DocsHome;
