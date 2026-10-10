import { ChatActions } from '@components/Chat';
import ChatBox from '@components/ChatBox';
import ChatList from '@components/ChatList';
import useInput from '@hooks/useInput';
import useJumpToMessage from '@hooks/useJumpToMessage';
import useSocket from '@hooks/useSocket';
import GifPicker from '@components/GifPicker';
import useFileUpload from '@hooks/useFileUpload';
import useTyping from '@hooks/useTyping';
import TypingIndicator from '@components/TypingIndicator';
import ConversationIntro from '@components/ConversationIntro';
import useOnlineList from '@hooks/useOnlineList';
import { DragOver } from '@pages/Channel/styles';
import { Header, Container } from '@pages/DirectMessage/styles';
import { IChat, IDM } from '@typings/db';
import { createTempId, cursorPageKey, removeChatFromPages, updateChatInPages } from '@utils/chatPages';
import getErrorMessage from '@utils/getErrorMessage';
import fetcher from '@utils/fetcher';
import { toGifContent } from '@utils/gif';
import makeSection from '@utils/makeSection';
import prependChat from '@utils/prependChat';
import axios from 'axios';
import { avatarUrl } from '@utils/avatar';
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
  const onlineList = useOnlineList(workspace);
  const { data: myData } = useSWR('/api/users', fetcher);
  const { data: userData } = useSWR(`/api/workspaces/${workspace}/users/${id}`, fetcher);
  const {
    data: chatData,
    mutate: mutateChat,
    setSize,
  } = useSWRInfinite<IDM[]>(cursorPageKey(`/api/workspaces/${workspace}/dms/${id}/chats`, PAGE_SIZE), fetcher, {
    onSuccess(data) {
      if (data?.length === 1) {
        setTimeout(() => {
          scrollbarRef.current?.scrollToBottom();
        }, 100);
      }
    },
  });
  const [chat, onChangeChat, setChat] = useInput('');
  const scrollbarRef = useRef<Scrollbars>(null);
  const [dragOver, setDragOver] = useState(false);

  const isEmpty = chatData?.[0]?.length === 0;
  const isReachingEnd = isEmpty || (chatData && chatData[chatData.length - 1]?.length < PAGE_SIZE);
  useJumpToMessage({ pages: chatData, isReachingEnd, setSize, scrollbarRef });
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

  // 텍스트 메시지와 GIF 가 함께 쓰는 전송 로직 (낙관적 업데이트 후 서버 응답으로 교체)
  const sendMessage = useCallback(
    (content: string) => {
      if (!chatData || !myData || !userData) {
        return;
      }
      const tempId = createTempId();
      mutateChat(
        (prevChatData) =>
          prependChat(prevChatData, {
            id: tempId,
            content,
            SenderId: myData.id,
            Sender: myData,
            ReceiverId: userData.id,
            Receiver: userData,
            createdAt: new Date(),
          }),
        false,
      ).then(() => {
        localStorage.setItem(`${workspace}-${id}`, new Date().getTime().toString());
        scrollbarRef.current?.scrollToBottom();
      });
      axios
        .post<IDM>(chatsKey, { content })
        .then(({ data }) => {
          // 임시 메시지를 서버가 저장한 메시지로 바꿔야 바로 수정/삭제할 수 있다
          mutateChat((pages) => updateChatInPages(pages, tempId, () => data), false);
        })
        .catch((error) => {
          mutateChat((pages) => removeChatFromPages(pages, tempId), false);
          toast.error(getErrorMessage(error), { position: 'bottom-center' });
        });
    },
    [workspace, id, myData, userData, chatData, mutateChat, chatsKey],
  );

  const onSubmitForm = useCallback(
    (e) => {
      e.preventDefault();
      if (chat?.trim()) {
        sendMessage(chat);
        setChat('');
      }
    },
    [chat, sendMessage, setChat],
  );

  const onSelectGif = useCallback((url: string) => sendMessage(toGifContent(url)), [sendMessage]);

  const onMessage = useCallback(
    (data: IDM) => {
      if (data.SenderId === Number(id) && myData.id !== Number(id)) {
        clearTypingUser(data.SenderId);
        // 보고 있는 동안 받은 메시지는 읽은 것으로 기록 (나중에 안 읽음으로 다시 잡히지 않게)
        localStorage.setItem(`${workspace}-${id}`, new Date().getTime().toString());
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
    [id, workspace, myData, mutateChat, clearTypingUser],
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

  const onUploaded = useCallback(() => {
    localStorage.setItem(`${workspace}-${id}`, new Date().getTime().toString());
    mutateChat();
  }, [workspace, id, mutateChat]);
  const { upload, uploading, progress } = useFileUpload(`/api/workspaces/${workspace}/dms/${id}/files`, onUploaded);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      upload(Array.from(e.dataTransfer.files || []));
    },
    [upload],
  );

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e) => {
    // 자식 요소로 이동할 때도 dragleave 가 발생하므로 영역을 벗어날 때만 끈다
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOver(false);
    }
  }, []);

  if (!userData || !myData) {
    return null;
  }

  const chatSections = makeSection(chatData ? ([] as IDM[]).concat(...chatData).reverse() : []);

  const isSelf = myData.id === userData.id;
  const isOnline = onlineList.includes(userData.id);
  const mentionTargets = isSelf ? [myData] : [userData, myData];

  return (
    <Container onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}>
      <Header>
        <img src={avatarUrl(userData, 64)} alt="" />
        <div>
          <strong>
            {userData.nickname}
            {isSelf && <span className="me"> (나)</span>}
          </strong>
          <small className={isOnline ? 'online' : undefined}>
            {isSelf ? '나에게 보내는 메모' : isOnline ? '● 온라인' : '○ 오프라인'}
          </small>
        </div>
      </Header>
      <ChatList
        scrollbarRef={scrollbarRef}
        isReachingEnd={isReachingEnd}
        isEmpty={isEmpty}
        chatSections={chatSections}
        setSize={setSize}
        myId={myData.id}
        actions={actions}
        intro={
          <ConversationIntro
            image={avatarUrl(userData, 144)}
            title={isSelf ? `${userData.nickname} (나)` : userData.nickname}
            description={
              isSelf ? (
                '나에게 보내는 메모 공간입니다. 할 일, 링크, 메모를 남겨두세요.'
              ) : (
                <>
                  <b>{userData.nickname}</b>님과 나눈 다이렉트 메시지의 시작입니다. 여기서 나눈 대화는 두 사람만 볼 수
                  있습니다.
                </>
              )
            }
          />
        }
      />
      <TypingIndicator names={typingUsers} />
      <ChatBox
        onSubmitForm={onSubmitForm}
        chat={chat}
        onChangeChat={onChangeChatWithTyping}
        placeholder={isSelf ? '나에게 메모 남기기' : `${userData.nickname}님에게 메시지 보내기`}
        data={mentionTargets}
        onAttachFiles={upload}
        uploading={uploading}
        uploadProgress={progress}
        toolbarExtra={<GifPicker onSelect={onSelectGif} />}
      />
      {dragOver && <DragOver>여기에 놓아서 파일 보내기</DragOver>}
    </Container>
  );
};

export default DirectMessage;
