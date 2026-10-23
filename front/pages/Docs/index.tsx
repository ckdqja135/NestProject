import useMyRole from '@hooks/useMyRole';
import { IUser } from '@typings/db';
import fetcher from '@utils/fetcher';
import React from 'react';
import { BookOpen, House, Library, Trash2 } from 'lucide-react';
import { NavLink, Route, Switch, useParams, useRouteMatch } from 'react-router-dom';
import useSWR from 'swr';
import DocPage from './DocPage';
import DocsHome from './DocsHome';
import DocsSidebar from './Sidebar';
import { DocsLayout, Main, MobileNav } from './styles';

// Docs: 슐랙 안에서 쓰는 문서·위키·슬라이드
const Docs = () => {
  const { workspace } = useParams<{ workspace: string }>();
  const { path } = useRouteMatch();
  const { data: me } = useSWR<IUser>('/api/users', fetcher);
  const myRole = useMyRole(workspace);
  if (!me) {
    return null;
  }
  const home = `/workspace/${workspace}/docs`;
  return (
    <DocsLayout>
      <DocsSidebar workspace={workspace} />
      <Main>
        <MobileNav aria-label="Docs 빠른 메뉴">
          <NavLink exact to={home} activeClassName="active">
            <House size={14} /> 홈
          </NavLink>
          {myRole !== 'guest' && (
            <NavLink to={`${home}/wiki`} activeClassName="active">
              <BookOpen size={14} /> Wiki
            </NavLink>
          )}
          <NavLink to={`${home}/mine`} activeClassName="active">
            <Library size={14} /> 내 문서
          </NavLink>
          <NavLink to={`${home}/trash`} activeClassName="active">
            <Trash2 size={14} /> 휴지통
          </NavLink>
        </MobileNav>
        <Switch>
          <Route exact path={path} render={() => <DocsHome mode="home" me={me} />} />
          <Route exact path={`${path}/wiki`} render={() => <DocsHome mode="wiki" me={me} />} />
          <Route exact path={`${path}/mine`} render={() => <DocsHome mode="mine" me={me} />} />
          <Route exact path={`${path}/trash`} render={() => <DocsHome mode="trash" me={me} />} />
          <Route path={`${path}/folder/:folderId`} render={() => <DocsHome mode="folder" me={me} />} />
          <Route path={`${path}/d/:docId`} render={() => <DocPage me={me} />} />
        </Switch>
      </Main>
    </DocsLayout>
  );
};

export default Docs;
