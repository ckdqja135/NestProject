import { CollapseButton } from '@components/DMList/styles';
import EachChannel from '@components/EachChannel';
import EachDM from '@components/EachDM';
import useMentions from '@hooks/useMentions';
import useOnlineList from '@hooks/useOnlineList';
import useSidebarPins from '@hooks/useSidebarPins';
import useSidebarSections, { ISidebarSection, SectionItemKind } from '@hooks/useSidebarSections';
import { IChannel, IUser, IUserWithOnline } from '@typings/db';
import fetcher from '@utils/fetcher';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import useSWR from 'swr';
import SidebarItem, { DRAG_TYPE, RENAME_SECTION_EVENT } from './SidebarItem';
import { SectionBlock } from './styles';

const readDrag = (e: React.DragEvent): { kind: SectionItemKind; id: number } | null => {
  try {
    const value = JSON.parse(e.dataTransfer.getData(DRAG_TYPE));
    return value && (value.kind === 'channel' || value.kind === 'dm') ? value : null;
  } catch {
    return null;
  }
};

// 원래 목록(Channels·Direct Messages) 머리에 놓으면 섹션에서 뺀다
export const useDropBack = () => {
  const { workspace } = useParams<{ workspace?: string }>();
  const { move } = useSidebarSections(workspace);
  return {
    onDragOver: (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes(DRAG_TYPE)) e.preventDefault();
    },
    onDrop: (e: React.DragEvent) => {
      const item = readDrag(e);
      if (item) move(item.kind, item.id, null);
    },
  };
};

// 사이드바에 내가 만든 섹션들 (고정됨 아래, 채널 위)
const SidebarSections = () => {
  const { workspace } = useParams<{ workspace?: string }>();
  const { data: userData } = useSWR<IUser>('/api/users', fetcher, { dedupingInterval: 2000 });
  const { data: channelData } = useSWR<IChannel[]>(userData ? `/api/workspaces/${workspace}/channels` : null, fetcher);
  const { data: memberData } = useSWR<IUserWithOnline[]>(
    userData ? `/api/workspaces/${workspace}/members` : null,
    fetcher,
  );
  const { data: mentions } = useMentions(workspace);
  const onlineList = useOnlineList(workspace);
  const { isPinned } = useSidebarPins(workspace);
  const { sections, create, rename, remove, move } = useSidebarSections(workspace);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [renaming, setRenaming] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [over, setOver] = useState<number | null>(null);

  useEffect(() => {
    const onRename = (e: Event) => setRenaming((e as CustomEvent<number>).detail);
    window.addEventListener(RENAME_SECTION_EVENT, onRename);
    return () => window.removeEventListener(RENAME_SECTION_EVENT, onRename);
  }, []);

  const nameInput = (initial: string, onDone: (name: string | null) => void) => (
    <input
      className="section-name-input"
      autoFocus
      defaultValue={initial}
      maxLength={40}
      aria-label="섹션 이름"
      onBlur={(e) => onDone(e.target.value.trim() || null)}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') onDone(null);
      }}
    />
  );

  const renderItems = (section: ISidebarSection) =>
    section.items.map((item) => {
      if (item.kind === 'channel') {
        const channel = channelData?.find((c) => c.id === item.id);
        if (!channel || isPinned('channel', channel.id)) return null;
        return (
          <SidebarItem key={`c${item.id}`} kind="channel" id={item.id} label={channel.name}>
            <EachChannel channel={channel} mentionCount={mentions?.unreadByChannel[channel.id]} />
          </SidebarItem>
        );
      }
      const member = memberData?.find((m) => m.id === item.id);
      if (!member || isPinned('dm', member.id)) return null;
      return (
        <SidebarItem key={`d${item.id}`} kind="dm" id={item.id} label={member.nickname}>
          <EachDM member={member} isOnline={onlineList.includes(member.id)} />
        </SidebarItem>
      );
    });

  return (
    <>
      {sections.map((section) => (
        <SectionBlock
          key={section.id}
          className={over === section.id ? 'over' : undefined}
          data-section={section.id}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
            e.preventDefault();
            setOver(section.id);
          }}
          onDragLeave={() => setOver((o) => (o === section.id ? null : o))}
          onDrop={(e) => {
            e.preventDefault();
            setOver(null);
            const item = readDrag(e);
            if (item) move(item.kind, item.id, section.id);
          }}
        >
          <h2>
            <CollapseButton
              collapse={!!collapsed[section.id]}
              onClick={() => setCollapsed((c) => ({ ...c, [section.id]: !c[section.id] }))}
            >
              <i
                className="c-icon p-channel_sidebar__section_heading_expand c-icon--caret-right c-icon--inherit c-icon--inline"
                aria-hidden="true"
              />
            </CollapseButton>
            {renaming === section.id ? (
              nameInput(section.name, (name) => {
                if (name && name !== section.name) rename(section.id, name);
                setRenaming(null);
              })
            ) : (
              <span onDoubleClick={() => setRenaming(section.id)}>{section.name}</span>
            )}
            <span className="tools">
              <button type="button" onClick={() => setRenaming(section.id)} aria-label={`${section.name} 이름 바꾸기`}>
                <Pencil size={12} />
              </button>
              <button type="button" onClick={() => remove(section.id)} aria-label={`${section.name} 섹션 지우기`}>
                <Trash2 size={12} />
              </button>
            </span>
          </h2>
          {!collapsed[section.id] && (
            <div>
              {renderItems(section)}
              {!section.items.length && <p className="empty">채널이나 DM 을 끌어다 놓으세요</p>}
            </div>
          )}
        </SectionBlock>
      ))}
      <SectionBlock>
        {adding ? (
          <h2>
            {nameInput('', (name) => {
              if (name) create(name);
              setAdding(false);
            })}
          </h2>
        ) : (
          <button type="button" className="add-section" onClick={() => setAdding(true)}>
            <Plus size={13} /> 섹션 만들기
          </button>
        )}
      </SectionBlock>
    </>
  );
};

export default SidebarSections;
