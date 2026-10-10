import { ChatActions } from '@components/Chat';
import ChatBox from '@components/ChatBox';
import ChatList from '@components/ChatList';
import useDraft, { draftKey } from '@hooks/useDraft';
import useJumpToMessage from '@hooks/useJumpToMessage';
import useFirstUnread from '@hooks/useFirstUnread';
import { canClosePanelWithEscape, requestEdit } from '@utils/editRequest';

import useSocket from '@hooks/useSocket';
import GifPicker from '@components/GifPicker';
import PollModal from '@components/PollModal';
import ScheduleButton from '@components/ScheduleButton';
import ScheduledBar from '@components/ScheduledBar';
import { AttachButton } from '@components/ChatBox/styles';
import { Poll, toPollContent } from '@utils/poll';
import { formatWhen } from '@utils/timePresets';

import useFileUpload from '@hooks/useFileUpload';
import useTyping from '@hooks/useTyping';
import TypingIndicator from '@components/TypingIndicator';
import ConversationIntro from '@components/ConversationIntro';
import useOnlineList from '@hooks/useOnlineList';
import { DragOver, HeaderButton, Layout } from '@pages/Channel/styles';
import PinnedPanel from '@components/PinnedPanel';
import { Header, Container } from '@pages/DirectMessage/styles';
import { IChat, IDM, IReaction } from '@typings/db';
import { createTempId, cursorPageKey, isTempId, removeChatFromPages, updateChatInPages } from '@utils/chatPages';
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
  // 쓰다 만 메시지는 대화별로 임시 저장된다
  const [chat, setChat] = useDraft(draftKey(workspace, `dm:${id}`));
  const onChangeChat = useCallback((e: { target: { value: string } }) => setChat(e.target.value), [setChat]);
  const scrollbarRef = useRef<Scrollbars>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showPinned, setShowPinned] = useState(false);

  // 입력창이 비어 있을 때 ↑ : 내 마지막 (글) 메시지를 수정
  const onEditLast = useCallback(() => {
    const last = chatData
      ?.flat()
      .find(
        (dm) =>
          dm.SenderId === myData?.id &&
          !isTempId(dm.id) &&
          !dm.content.startsWith('file:') &&
          !dm.content.startsWith('gif:'),
      );
    if (last) {
      document.querySelector(`[data-chat-id="${last.id}"]`)?.scrollIntoView({ block: 'nearest' });
      requestEdit(last.id);
    }
  }, [chatData, myData?.id]);

  // Esc : 고정 메시지 패널 닫기
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (canClosePanelWithEscape(e)) {
        setShowPinned(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // 다른 대화로 옮기면 고정 메시지 패널을 닫는다
  useEffect(() => {
    setShowPinned(false);
  }, [workspace, id]);

  const isEmpty = chatData?.[0]?.length === 0;
  const isReachingEnd = isEmpty || (chatData && chatData[chatData.length - 1]?.length < PAGE_SIZE);
  // 들어오기 전에 읽지 않은 첫 메시지 위에 '새 메시지' 구분선
  const isMineDM = useCallback((dm: IDM) => dm.SenderId === myData?.id, [myData?.id]);
  const firstUnreadId = useFirstUnread(`${workspace}-${id}`, chatData, isMineDM, scrollbarRef, isReachingEnd, setSize);
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

  // 투표 만들기, 정한 시각에 보내기
  const [showPollModal, setShowPollModal] = useState(false);
  const onCreatePoll = useCallback((poll: Poll) => sendMessage(toPollContent(poll)), [sendMessage]);
  const onSchedule = useCallback(
    (date: Date) => {
      if (!chat?.trim()) {
        return;
      }
      axios
        .post(`/api/workspaces/${workspace}/scheduled`, {
          ...{ receiverId: Number(id) },
          content: chat,
          sendAt: date.toISOString(),
        })
        .then(() => {
          setChat('');
          toast.success(`${formatWhen(date)}에 보낼게요.`, { position: 'bottom-center' });
        })
        .catch((error) => toast.error(getErrorMessage(error), { position: 'bottom-center' }));
    },
    [workspace, id, chat, setChat],
  );

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

  const onDMReactionUpdated = useCallback(
    (data: { id: number; SenderId: number; ReceiverId: number; Reactions: IReaction[] }) => {
      if (isThisConversation(data)) {
        mutateChat((pages) => updateChatInPages(pages, data.id, (dm) => ({ ...dm, Reactions: data.Reactions })), false);
      }
    },
    [isThisConversation, mutateChat],
  );

  useEffect(() => {
    socket?.on('dm', onMessage);
    socket?.on('dmUpdated', onDMUpdated);
    socket?.on('dmDeleted', onDMDeleted);
    socket?.on('dmReactionUpdated', onDMReactionUpdated);
    return () => {
      socket?.off('dm', onMessage);
      socket?.off('dmUpdated', onDMUpdated);
      socket?.off('dmDeleted', onDMDeleted);
      socket?.off('dmReactionUpdated', onDMReactionUpdated);
    };
  }, [socket, onMessage, onDMUpdated, onDMDeleted, onDMReactionUpdated]);

  // DM 메시지 액션: 수정/삭제(보낸 사람), 리액션/고정(둘 다). 화면 갱신은 소켓 이벤트로 처리
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
      onReact: (target: IDM | IChat, emoji: string) => {
        axios
          .post(`${chatsKey}/${target.id}/reactions`, { emoji })
          .catch((error) => toast.error(getErrorMessage(error), { position: 'bottom-center' }));
      },
      onTogglePin: (target: IDM | IChat) => {
        const request = target.pinned
          ? axios.delete(`${chatsKey}/${target.id}/pin`)
          : axios.post(`${chatsKey}/${target.id}/pin`);
        request.catch((error) => toast.error(getErrorMessage(error), { position: 'bottom-center' }));
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
    <Layout>
      <Container onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}>
        <Header>
          <img src={avatarUrl(userData, 64)} alt="" />
          <div>
            <strong>
              {userData.nickname}
              {isSelf && <span className="me"> (나)</span>}
            </strong>
            <small className={isOnline && !userData.away ? 'online' : undefined}>
              {isSelf ? '나에게 보내는 메모' : isOnline ? (userData.away ? '○ 자리 비움' : '● 온라인') : '○ 오프라인'}
              {(userData.statusEmoji || userData.statusText) && (
                <span className="status">
                  {' · '}
                  {userData.statusEmoji} {userData.statusText}
                </span>
              )}
            </small>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <HeaderButton
              type="button"
              className={showPinned ? 'active' : undefined}
              onClick={() => setShowPinned((prev) => !prev)}
              title="고정된 메시지"
            >
              📌 고정
            </HeaderButton>
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
          firstUnreadId={firstUnreadId}
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
        <ScheduledBar workspace={workspace} receiverId={Number(id)} />
        <PollModal show={showPollModal} onCloseModal={() => setShowPollModal(false)} onCreate={onCreatePoll} />
        <ChatBox
          onSubmitForm={onSubmitForm}
          chat={chat}
          onChangeChat={onChangeChatWithTyping}
          placeholder={isSelf ? '나에게 메모 남기기' : `${userData.nickname}님에게 메시지 보내기`}
          data={mentionTargets}
          onEditLast={onEditLast}
          onAttachFiles={upload}
          uploading={uploading}
          uploadProgress={progress}
          toolbarExtra={
            <>
              <GifPicker onSelect={onSelectGif} />
              <AttachButton type="button" onClick={() => setShowPollModal(true)} title="투표 만들기">
                📊 투표
              </AttachButton>
              <ScheduleButton disabled={!chat?.trim()} onSchedule={onSchedule} />
            </>
          }
        />
        {dragOver && <DragOver>여기에 놓아서 파일 보내기</DragOver>}
      </Container>
      {showPinned && (
        <PinnedPanel
          pinnedUrl={`/api/workspaces/${workspace}/dms/${id}/pinned`}
          revalidateOn={['dmUpdated', 'dmDeleted', 'dmReactionUpdated']}
          myId={myData.id}
          socket={socket}
          actions={actions}
          onClose={() => setShowPinned(false)}
        />
      )}
    </Layout>
  );
};

export default DirectMessage;
