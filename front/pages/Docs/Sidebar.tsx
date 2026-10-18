import { IDocFolder, IDocListItem, IWikiPage } from '@typings/db';
import fetcher from '@utils/fetcher';
import { DOC_TYPE_INFO } from '@utils/docTemplates';
import React, { FC, useCallback, useMemo, useState } from 'react';
import { NavLink, useHistory } from 'react-router-dom';
import useSWR from 'swr';
import { docPath, docsBase, useDocsChanged } from './api';
import FolderModal from './FolderModal';
import { Sidebar } from './styles';

interface Props {
  workspace: string;
}

// 부모 → 자식 목록
const childrenOf = <T extends { id: number }>(items: T[], parentOf: (item: T) => number | null) => {
  const map = new Map<number | null, T[]>();
  items.forEach((item) => {
    const parent = parentOf(item);
    // 부모가 목록에 없으면 (휴지통 등) 맨 위에 둔다
    const key = parent && items.some((v) => v.id === parent) ? parent : null;
    map.set(key, [...(map.get(key) || []), item]);
  });
  return map;
};

const WikiTree: FC<{ workspace: string; pages: IWikiPage[] }> = ({ workspace, pages }) => {
  const tree = useMemo(() => childrenOf(pages, (p) => p.ParentId), [pages]);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const renderLevel = (parent: number | null, depth: number): React.ReactNode =>
    (tree.get(parent) || []).map((page) => {
      const kids = tree.get(page.id);
      return (
        <React.Fragment key={page.id}>
          <NavLink
            className="item"
            activeClassName="active"
            to={docPath(workspace, page.id)}
            style={{ paddingLeft: 10 + depth * 14 }}
            title={page.title}
          >
            {kids ? (
              <span
                role="button"
                aria-label={open[page.id] ? '접기' : '펼치기'}
                onClick={(e) => {
                  e.preventDefault();
                  setOpen((v) => ({ ...v, [page.id]: !v[page.id] }));
                }}
              >
                {open[page.id] ? '▾' : '▸'}
              </span>
            ) : (
              <span style={{ visibility: 'hidden' }}>▸</span>
            )}
            <span className="label">{page.title}</span>
          </NavLink>
          {kids && open[page.id] && renderLevel(page.id, depth + 1)}
        </React.Fragment>
      );
    });
  if (!pages.length) {
    return <p className="empty">아직 위키 페이지가 없습니다.</p>;
  }
  return <>{renderLevel(null, 0)}</>;
};

const FolderTree: FC<{ workspace: string; folders: IDocFolder[] }> = ({ workspace, folders }) => {
  const tree = useMemo(() => childrenOf(folders, (f) => f.ParentId), [folders]);
  const renderLevel = (parent: number | null, depth: number): React.ReactNode =>
    (tree.get(parent) || []).map((folder) => (
      <React.Fragment key={folder.id}>
        <NavLink
          className="item"
          activeClassName="active"
          to={`/workspace/${workspace}/docs/folder/${folder.id}`}
          style={{ paddingLeft: 10 + depth * 14 }}
          title={folder.name}
        >
          📁 <span className="label">{folder.name}</span>
        </NavLink>
        {renderLevel(folder.id, depth + 1)}
      </React.Fragment>
    ));
  return <>{renderLevel(null, 0)}</>;
};

// Docs 왼쪽 목록: 홈, 위키, 고정된 문서, 내 문서 라이브러리, 휴지통
const DocsSidebar: FC<Props> = ({ workspace }) => {
  const history = useHistory();
  const base = docsBase(workspace);
  const { data: wiki, mutate: refreshWiki } = useSWR<IWikiPage[]>(`${base}/docs/wiki`, fetcher);
  const { data: pinned, mutate: refreshPinned } = useSWR<IDocListItem[]>(`${base}/docs?tab=favorites`, fetcher);
  const { data: folders, mutate: refreshFolders } = useSWR<IDocFolder[]>(`${base}/doc-folders`, fetcher);
  const refresh = useCallback(() => {
    refreshWiki();
    refreshPinned();
    refreshFolders();
  }, [refreshWiki, refreshPinned, refreshFolders]);
  useDocsChanged(workspace, refresh);
  const [search, setSearch] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const home = `/workspace/${workspace}/docs`;

  return (
    <Sidebar aria-label="Docs 메뉴">
      <div className="title">Docs</div>
      <form
        className="search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const q = search.trim();
          history.push(q ? `${home}?q=${encodeURIComponent(q)}` : home);
        }}
      >
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="문서 제목 검색"
          aria-label="문서 제목 검색"
        />
      </form>
      <NavLink className="item" activeClassName="active" exact to={home}>
        🏠 <span className="label">홈</span>
      </NavLink>
      <NavLink className="item" activeClassName="active" exact to={`${home}/wiki`}>
        📚 <span className="label">Wiki</span>
      </NavLink>
      {wiki && <WikiTree workspace={workspace} pages={wiki} />}

      <h4>고정된 Docs</h4>
      {pinned?.length ? (
        pinned.map((doc) => (
          <NavLink
            key={doc.id}
            className="item"
            activeClassName="active"
            to={docPath(workspace, doc.id)}
            title={doc.title}
          >
            {DOC_TYPE_INFO[doc.type].icon} <span className="label">{doc.title}</span>
          </NavLink>
        ))
      ) : (
        <p className="empty">문서에서 ☆ 를 누르면 여기에 고정됩니다.</p>
      )}

      <h4>
        내 문서 라이브러리
        <button type="button" onClick={() => setShowNewFolder(true)} title="새 폴더" aria-label="새 폴더">
          +
        </button>
      </h4>
      <NavLink className="item" activeClassName="active" exact to={`${home}/mine`}>
        🗂 <span className="label">내 문서 전체</span>
      </NavLink>
      {folders && <FolderTree workspace={workspace} folders={folders} />}

      <div className="bottom">
        <NavLink className="item" activeClassName="active" to={`${home}/trash`}>
          🗑 <span className="label">휴지통</span>
        </NavLink>
      </div>
      <FolderModal
        show={showNewFolder}
        workspace={workspace}
        onCloseModal={() => setShowNewFolder(false)}
        onDone={(folder) => {
          refreshFolders();
          history.push(`${home}/folder/${folder.id}`);
        }}
      />
    </Sidebar>
  );
};

export default DocsSidebar;
