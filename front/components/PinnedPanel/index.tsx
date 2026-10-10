import Chat, { ChatActions } from '@components/Chat';
import { EmptyText, Panel, PanelBody, PanelHeader } from '@components/SidePanel/styles';
import { IChat, IDM } from '@typings/db';
import fetcher from '@utils/fetcher';
import React, { FC, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import useSWR from 'swr';

interface Props {
  pinnedUrl: string; // 고정 목록 API (채널 또는 DM)
  revalidateOn: string[]; // 이 소켓 이벤트가 오면 목록을 다시 불러온다
  myId: number;
  socket?: Socket;
  actions: ChatActions;
  onClose: () => void;
}

// 고정된 메시지 목록 패널
const PinnedPanel: FC<Props> = ({ pinnedUrl, revalidateOn, myId, socket, actions, onClose }) => {
  const { data: pinned, mutate } = useSWR<(IChat | IDM)[]>(pinnedUrl, fetcher);
  const events = revalidateOn.join(',');

  useEffect(() => {
    // 고정/해제, 수정, 삭제, 리액션이 바뀌면 목록을 다시 불러온다
    const revalidate = () => mutate();
    const names = events.split(',');
    names.forEach((name) => socket?.on(name, revalidate));
    return () => {
      names.forEach((name) => socket?.off(name, revalidate));
    };
  }, [socket, mutate, events]);

  return (
    <Panel aria-label="고정된 메시지">
      <PanelHeader>
        <span>📌 고정된 메시지</span>
        <button type="button" onClick={onClose} aria-label="고정 메시지 닫기">
          &times;
        </button>
      </PanelHeader>
      <PanelBody>
        {pinned?.length === 0 && <EmptyText>고정된 메시지가 없습니다.</EmptyText>}
        {pinned?.map((c) => (
          <Chat key={c.id} data={c} myId={myId} actions={actions} />
        ))}
      </PanelBody>
    </Panel>
  );
};

export default PinnedPanel;
