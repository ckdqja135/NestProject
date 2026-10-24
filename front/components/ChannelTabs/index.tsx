import useSocket from '@hooks/useSocket';
import DocIcon from '@pages/Docs/DocIcon';
import fetcher from '@utils/fetcher';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import { Lock, MessageSquare, MoreHorizontal, Plus } from 'lucide-react';
import React, { FC, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import useSWR from 'swr';
import AddTabModal from './AddTabModal';
import { Bar, TabMenu } from './styles';

export interface IChannelTab {
  id: number;
  docId: number;
  access: 'none' | 'view' | 'edit';
  // 댓글·수정·항목 변경을 채널에 알리는지
  notify: boolean;
  creatorId: number | null;
  canView: boolean;
  canManage: boolean;
  title: string | null;
  type: string | null;
}

const ACCESS_LABEL = {
  none: '문서 권한 그대로',
  view: '채널 멤버 보기',
  edit: '채널 멤버 편집',
} as const;

interface Props {
  workspace: string;
  channel: string;
  // 지금 연 탭의 문서 (없으면 메시지)
  active: number | null;
  onSelect: (docId: number | null) => void;
  // 탭을 더할 수 있는지 (게스트·보관된 채널은 못 한다)
  canAdd: boolean;
}

// 채널 머리 아래의 탭 줄: 메시지 | 고정한 문서들 | +
const ChannelTabs: FC<Props> = ({ workspace, channel, active, onSelect, canAdd }) => {
  const base = `/api/workspaces/${workspace}/channels/${encodeURIComponent(channel)}/tabs`;
  const { data: tabs, mutate } = useSWR<IChannelTab[]>(base, fetcher);
  const [socket] = useSocket(workspace);
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState<number | null>(null);
  // 탭 줄은 옆으로 스크롤되어 메뉴가 잘리므로, 누른 단추 아래 화면 좌표에 띄운다
  const [menuAt, setMenuAt] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const refresh = () => mutate();
    socket?.on('channelTabsChanged', refresh);
    // 탭 문서의 제목·권한이 바뀌면 다시 받는다
    socket?.on('docsChanged', refresh);
    socket?.on('docAccess', refresh);
    return () => {
      socket?.off('channelTabsChanged', refresh);
      socket?.off('docsChanged', refresh);
      socket?.off('docAccess', refresh);
    };
  }, [socket, mutate]);

  useEffect(() => {
    if (menu === null) return undefined;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(null);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menu]);

  // 연 탭이 빠지면 메시지로 돌아간다 (목록에 있던 탭이 없어졌을 때만. 막 만든 탭은 아직 목록에 없을 수 있다)
  const seen = useRef(new Set<number>());
  useEffect(() => {
    if (!tabs) return;
    const ids = new Set(tabs.map((t) => t.docId));
    if (active && seen.current.has(active) && !ids.has(active)) onSelect(null);
    seen.current = ids;
  }, [active, tabs, onSelect]);

  const fail = (err: unknown) => toast.error(getErrorMessage(err), { position: 'bottom-center' });
  // 누르자마자 바뀐 것으로 보이고, 서버 결과로 다시 맞춘다 (실패하면 되돌아간다)
  const patchLocal = (tab: IChannelTab, change: Partial<IChannelTab>) =>
    mutate((list) => list?.map((t) => (t.id === tab.id ? { ...t, ...change } : t)), false);
  const setAccess = (tab: IChannelTab, access: IChannelTab['access']) => {
    patchLocal(tab, { access });
    return axios
      .patch(`${base}/${tab.id}`, { access })
      .then(() => {
        mutate();
        toast.info(`#${channel} 멤버: ${ACCESS_LABEL[access]}`, { position: 'bottom-center' });
      })
      .catch((err) => {
        mutate();
        fail(err);
      });
  };
  const setNotify = (tab: IChannelTab, notify: boolean) => {
    patchLocal(tab, { notify });
    return axios
      .patch(`${base}/${tab.id}`, { notify })
      .then(() => {
        mutate();
        toast.info(notify ? `#${channel} 에 이 문서의 변경을 알려요.` : '변경 알림을 껐어요.', {
          position: 'bottom-center',
        });
      })
      .catch((err) => {
        mutate();
        fail(err);
      });
  };
  const remove = (tab: IChannelTab) =>
    axios
      .delete(`${base}/${tab.id}`)
      .then(() => {
        setMenu(null);
        if (active === tab.docId) onSelect(null);
        mutate();
      })
      .catch(fail);

  if (!tabs?.length && !canAdd) return null;

  return (
    <Bar role="tablist" aria-label="채널 탭">
      <button
        type="button"
        role="tab"
        aria-selected={active === null}
        className={active === null ? 'on' : undefined}
        onClick={() => onSelect(null)}
      >
        <MessageSquare size={14} /> 메시지
      </button>
      {(tabs || []).map((tab) => (
        <div key={tab.id} className={`tab${active === tab.docId ? ' on' : ''}`}>
          <button
            type="button"
            role="tab"
            aria-selected={active === tab.docId}
            onClick={() => onSelect(tab.docId)}
            title={tab.canView ? tab.title || '' : '볼 권한이 없는 문서'}
          >
            {tab.canView && tab.type ? <DocIcon type={tab.type as any} size={14} /> : <Lock size={13} />}
            <span className="label">{tab.canView ? tab.title : '볼 수 없는 문서'}</span>
          </button>
          <button
            type="button"
            className="more"
            aria-label={`${tab.title || '탭'} 메뉴`}
            aria-expanded={menu === tab.id}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setMenuAt({ top: rect.bottom + 4, left: Math.max(8, rect.right - 220) });
              setMenu((v) => (v === tab.id ? null : tab.id));
            }}
          >
            <MoreHorizontal size={13} />
          </button>
          {menu === tab.id && (
            <TabMenu ref={menuRef} role="menu" aria-label="탭 메뉴" style={menuAt}>
              {tab.canManage ? (
                <label>
                  #{channel} 멤버 권한
                  <select
                    value={tab.access}
                    onChange={(e) => setAccess(tab, e.target.value as IChannelTab['access'])}
                    aria-label="채널 멤버 권한"
                  >
                    {(Object.keys(ACCESS_LABEL) as IChannelTab['access'][]).map((a) => (
                      <option key={a} value={a}>
                        {ACCESS_LABEL[a]}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="hint">{ACCESS_LABEL[tab.access]}</p>
              )}
              <label className="check">
                <input
                  type="checkbox"
                  checked={tab.notify}
                  onChange={(e) => setNotify(tab, e.target.checked)}
                  aria-label="변경을 채널에 알리기"
                />
                변경을 채널에 알리기
                <small>댓글, 수정(30분에 한 번), 데이터베이스 새 항목·상태</small>
              </label>
              <button type="button" role="menuitem" className="danger" onClick={() => remove(tab)}>
                탭 빼기
              </button>
            </TabMenu>
          )}
        </div>
      ))}
      {canAdd && (
        <button type="button" className="add" onClick={() => setAdding(true)} aria-label="탭 추가" title="탭 추가">
          <Plus size={14} />
        </button>
      )}
      {adding && (
        <AddTabModal
          workspace={workspace}
          channel={channel}
          onClose={() => setAdding(false)}
          onAdded={(docId) => {
            setAdding(false);
            mutate();
            onSelect(docId);
          }}
        />
      )}
    </Bar>
  );
};

export default ChannelTabs;
