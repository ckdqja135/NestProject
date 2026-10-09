import { ChatActions } from '@components/Chat';
import ChatBox from '@components/ChatBox';
import ChatList from '@components/ChatList';
import useInput from '@hooks/useInput';
import useSocket from '@hooks/useSocket';
import useTyping from '@hooks/useTyping';
import TypingIndicator from '@components/TypingIndicator';
import { DragOver } from '@pages/Channel/styles';
import { Header, Container } from '@pages/DirectMessage/styles';
import { IChat, IDM } from '@typings/db';
import { createTempId, removeChatFromPages, updateChatInPages } from '@utils/chatPages';
import getErrorMessage from '@utils/getErrorMessage';
import fetcher from '@utils/fetcher';
import makeSection from '@utils/makeSection';
import prependChat from '@utils/prependChat';
import axios from 'axios';
import gravatar from 'gravatar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Scrollbars } from 'react-custom-scrollbars-2';
import { useParams } from 'react-router';
import { toast } from 'react-toastify';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';

const PAGE_SIZE = 20;
const DirectMessage = () => {
  const { workspace, id } = useParams<{ workspace: string; id: string }>();
  const [socket] = useSocket(workspace);
  const { data: myData } = useSWR('/api/users', fetcher);
  const { data: userData } = useSWR(`/api/workspaces/${workspace}/users/${id}`, fetcher);
  const {
    data: chatData,
    mutate: mutateChat,
    setSize,
  } = useSWRInfinite<IDM[]>(
    (index) => `/api/workspaces/${workspace}/dms/${id}/chats?perPage=${PAGE_SIZE}&page=${index + 1}`,
    fetcher,
    {
      onSuccess(data) {
        if (data?.length === 1) {
          setTimeout(() => {
            scrollbarRef.current?.scrollToBottom();
          }, 100);
        }
      },
    },
  );
  const [chat, onChangeChat, setChat] = useInput('');
  const scrollbarRef = useRef<Scrollbars>(null);
  const [dragOver, setDragOver] = useState(false);

  const isEmpty = chatData?.[0]?.length === 0;
  const isReachingEnd = isEmpty || (chatData && chatData[chatData.length - 1]?.length < PAGE_SIZE);
  const chatsKey = `/api/workspaces/${workspace}/dms/${id}/chats`;
  const { typingUsers, notifyTyping, clearTypingUser } = useTyping({
    socket,
    nickname: myData?.nickname,
    receiverId: Number(id),
  });

  const onChangeChatWithTyping = useCallback(
    (e) => {
      onChangeChat(e);
      // 나에게 보내는 DM 이면 입력 중 표시를 보낼 필요가 없다
      if (myData && myData.id !== Number(id)) {
        notifyTyping();
      }
    },
    [onChangeChat, notifyTyping, myData, id],
  );

  const onSubmitForm = useCallback(
    (e) => {
      e.preventDefault();
      if (chat?.trim() && chatData) {
        const savedChat = chat;
        const tempId = createTempId();
        mutateChat(
          (prevChatData) =>
            prependChat(prevChatData, {
              id: tempId,
              content: savedChat,
              SenderId: myData.id,
              Sender: myData,
              ReceiverId: userData.id,
              Receiver: userData,
              createdAt: new Date(),
            }),
          false,
        ).then(() => {
          localStorage.setItem(`${workspace}-${id}`, new Date().getTime().toString());
          setChat('');
          scrollbarRef.current?.scrollToBottom();
        });
        axios
          .post<IDM>(chatsKey, { content: savedChat })
          .then(({ data }) => {
            // 임시 메시지를 서버가 저장한 메시지로 바꿔야 바로 수정/삭제할 수 있다
            mutateChat((pages) => updateChatInPages(pages, tempId, () => data), false);
          })
          .catch((error) => {
            mutateChat((pages) => removeChatFromPages(pages, tempId), false);
            toast.error(getErrorMessage(error), { position: 'bottom-center' });
          });
      }
    },
    [chat, workspace, id, myData, userData, chatData, mutateChat, setChat, chatsKey],
  );

  const onMessage = useCallback(
    (data: IDM) => {
      if (data.SenderId === Number(id) && myData.id !== Number(id)) {
        clearTypingUser(data.SenderId);
        mutateChat((chatData) => prependChat(chatData, data), false).then(() => {
          if (scrollbarRef.current) {
            if (
              scrollbarRef.current.getScrollHeight() <
              scrollbarRef.current.getClientHeight() + scrollbarRef.current.getScrollTop() + 150
            ) {
              console.log('scrollToBottom!', scrollbarRef.current?.getValues());
              setTimeout(() => {
                scrollbarRef.current?.scrollToBottom();
              }, 100);
            } else {
              toast.success('새 메시지가 도착했습니다.', {
                onClick() {
                  scrollbarRef.current?.scrollToBottom();
                },
                closeOnClick: true,
              });
            }
          }
        });
      }
    },
    [id, myData, mutateChat, clearTypingUser],
  );

  // 이 대화방(나 ↔ id)의 메시지인지
  const isThisConversation = useCallback(
    (data: { SenderId: number; ReceiverId: number }) =>
      !!myData &&
      ((data.SenderId === myData.id && data.ReceiverId === Number(id)) ||
        (data.SenderId === Number(id) && data.ReceiverId === myData.id)),
    [myData, id],
  );

  const onDMUpdated = useCallback(
    (data: IDM) => {
      if (isThisConversation(data)) {
        mutateChat((pages) => updateChatInPages(pages, data.id, () => data), false);
      }
    },
    [isThisConversation, mutateChat],
  );

  const onDMDeleted = useCallback(
    (data: { id: number; SenderId: number; ReceiverId: number }) => {
      if (isThisConversation(data)) {
        mutateChat((pages) => removeChatFromPages(pages, data.id), false);
      }
    },
    [isThisConversation, mutateChat],
  );

  useEffect(() => {
    socket?.on('dm', onMessage);
    socket?.on('dmUpdated', onDMUpdated);
    socket?.on('dmDeleted', onDMDeleted);
    return () => {
      socket?.off('dm', onMessage);
      socket?.off('dmUpdated', onDMUpdated);
      socket?.off('dmDeleted', onDMDeleted);
    };
  }, [socket, onMessage, onDMUpdated, onDMDeleted]);

  // DM 은 수정/삭제만 지원 (화면 갱신은 소켓 이벤트로 처리)
  const actions: ChatActions = useMemo(
    () => ({
      onEdit: (target: IDM | IChat, content: string) =>
        axios.patch(`${chatsKey}/${target.id}`, { content }).catch((error) => {
          toast.error(getErrorMessage(error), { position: 'bottom-center' });
          throw error;
        }),
      onDelete: (target: IDM | IChat) => {
        axios
          .delete(`${chatsKey}/${target.id}`)
          .catch((error) => toast.error(getErrorMessage(error), { position: 'bottom-center' }));
      },
    }),
    [chatsKey],
  );

  useEffect(() => {
    localStorage.setItem(`${workspace}-${id}`, new Date().getTime().toString());
  }, [workspace, id]);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      console.log(e);
      const formData = new FormData();
      if (e.dataTransfer.items) {
        // Use DataTransferItemList interface to access the file(s)
        for (let i = 0; i < e.dataTransfer.items.length; i++) {
          // If dropped items aren't files, reject them
          if (e.dataTransfer.items[i].kind === 'file') {
            const file = e.dataTransfer.items[i].getAsFile();
            console.log('... file[' + i + '].name = ' + file.name);
            formData.append('image', file);
          }
        }
      } else {
        // Use DataTransfer interface to access the file(s)
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          console.log('... file[' + i + '].name = ' + e.dataTransfer.files[i].name);
          formData.append('image', e.dataTransfer.files[i]);
        }
      }
      axios.post(`/api/workspaces/${workspace}/dms/${id}/images`, formData).then(() => {
        setDragOver(false);
        localStorage.setItem(`${workspace}-${id}`, new Date().getTime().toString());
        mutateChat();
      });
    },
    [workspace, id, mutateChat],
  );

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    console.log(e);
    setDragOver(true);
  }, []);

  if (!userData || !myData) {
    return null;
  }

  const chatSections = makeSection(chatData ? ([] as IDM[]).concat(...chatData).reverse() : []);

  return (
    <Container onDrop={onDrop} onDragOver={onDragOver}>
      <Header>
        <img src={gravatar.url(userData.email, { s: '24px', d: 'retro' })} alt={userData.nickname} />
        <span>{userData.nickname}</span>
      </Header>
      <ChatList
        scrollbarRef={scrollbarRef}
        isReachingEnd={isReachingEnd}
        isEmpty={isEmpty}
        chatSections={chatSections}
        setSize={setSize}
        myId={myData.id}
        actions={actions}
      />
      <TypingIndicator names={typingUsers} />
      <ChatBox
        onSubmitForm={onSubmitForm}
        chat={chat}
        onChangeChat={onChangeChatWithTyping}
        placeholder={`Message ${userData.nickname}`}
        data={[]}
      />
      {dragOver && <DragOver>업로드!</DragOver>}
    </Container>
  );
};

export default DirectMessage;
