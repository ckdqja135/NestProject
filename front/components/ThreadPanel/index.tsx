import Chat, { ChatActions } from '@components/Chat';
import ChatBox from '@components/ChatBox';
import { Divider, EmptyText, Panel, PanelBody, PanelHeader } from '@components/SidePanel/styles';
import { IChat, IReaction, IUser } from '@typings/db';
import { createTempId } from '@utils/chatPages';
import fetcher from '@utils/fetcher';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { toast } from 'react-toastify';
import useSWR from 'swr';

interface Props {
  workspace: string;
  channel: string;
  parent: IChat;
  me: IUser;
  members?: IUser[];
  socket?: Socket;
  actions: ChatActions;
  onClose: () => void;
}

// 스레드 패널: 원본 메시지와 답글 목록, 답글 입력창
const ThreadPanel: FC<Props> = ({ workspace, channel, parent, me, members, socket, actions, onClose }) => {
  const repliesKey = `/api/workspaces/${workspace}/channels/${channel}/chats/${parent.id}/replies`;
  const { data: replies, mutate } = useSWR<IChat[]>(repliesKey, fetcher);
  const [reply, setReply] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);
  // 이미 스레드 안이므로 '답글' 버튼/링크는 숨긴다
  const threadActions = useMemo(() => ({ ...actions, onReply: undefined }), [actions]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (bodyRef.current) {
        bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
      }
    }, 50);
  }, []);

  useEffect(() => {
    if (replies) {
      scrollToBottom();
    }
  }, [replies?.length, scrollToBottom]);

  useEffect(() => {
    const onMessage = (data: IChat) => {
      if (data.ParentId !== parent.id) {
        return;
      }
      mutate((prev) => (prev?.some((c) => c.id === data.id) ? prev : [...(prev || []), data]), false);
    };
    const onUpdated = (data: IChat) => {
      if (data.ParentId === parent.id) {
        mutate((prev) => prev?.map((c) => (c.id === data.id ? data : c)), false);
      }
    };
    const onDeleted = (data: { id: number; ParentId: number | null }) => {
      if (data.ParentId === parent.id) {
        mutate((prev) => prev?.filter((c) => c.id !== data.id), false);
      }
    };
    const onReaction = (data: { id: number; ParentId: number | null; Reactions: IReaction[] }) => {
      if (data.ParentId === parent.id) {
        mutate((prev) => prev?.map((c) => (c.id === data.id ? { ...c, Reactions: data.Reactions } : c)), false);
      }
    };
    socket?.on('message', onMessage);
    socket?.on('messageUpdated', onUpdated);
    socket?.on('messageDeleted', onDeleted);
    socket?.on('reactionUpdated', onReaction);
    return () => {
      socket?.off('message', onMessage);
      socket?.off('messageUpdated', onUpdated);
      socket?.off('messageDeleted', onDeleted);
      socket?.off('reactionUpdated', onReaction);
    };
  }, [socket, parent.id, mutate]);

  const onChangeReply = useCallback((e) => setReply(e.target.value), []);

  const onSubmitReply = useCallback(
    (e) => {
      e.preventDefault();
      const content = reply.trim();
      if (!content) {
        return;
      }
      const tempId = createTempId();
      const optimistic: IChat = {
        id: tempId,
        content,
        UserId: me.id,
        User: me,
        createdAt: new Date(),
        ChannelId: parent.ChannelId,
        Channel: parent.Channel,
        ParentId: parent.id,
        Reactions: [],
      };
      mutate((prev) => [...(prev || []), optimistic], false);
      setReply('');
      axios
        .post<IChat>(`/api/workspaces/${workspace}/channels/${channel}/chats/${parent.id}/replies`, { content })
        .then(({ data }) => {
          // 소켓으로 먼저 도착했으면 임시 메시지만 지우고, 아니면 실제 메시지로 바꾼다
          mutate(
            (prev) =>
              prev?.some((c) => c.id === data.id)
                ? prev.filter((c) => c.id !== tempId)
                : prev?.map((c) => (c.id === tempId ? data : c)),
            false,
          );
        })
        .catch((error) => {
          mutate((prev) => prev?.filter((c) => c.id !== tempId), false);
          toast.error(getErrorMessage(error), { position: 'bottom-center' });
        });
    },
    [reply, me, parent, workspace, channel, mutate],
  );

  return (
    <Panel aria-label="스레드">
      <PanelHeader>
        <span>스레드</span>
        <small>#{channel}</small>
        <button type="button" onClick={onClose} aria-label="스레드 닫기">
          &times;
        </button>
      </PanelHeader>
      <PanelBody ref={bodyRef}>
        <Chat data={parent} myId={me.id} actions={threadActions} />
        <Divider>{replies ? `답글 ${replies.length}개` : '불러오는 중...'}</Divider>
        {replies?.length === 0 && <EmptyText>첫 답글을 남겨보세요.</EmptyText>}
        {replies?.map((c) => (
          <Chat key={c.id} data={c} myId={me.id} actions={threadActions} />
        ))}
      </PanelBody>
      <ChatBox
        inputId="thread-reply"
        onSubmitForm={onSubmitReply}
        chat={reply}
        onChangeChat={onChangeReply}
        placeholder="답글 달기..."
        data={members}
      />
    </Panel>
  );
};

export default ThreadPanel;
