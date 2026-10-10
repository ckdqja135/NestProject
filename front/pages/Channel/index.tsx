import { ChatActions } from '@components/Chat';
import ChatBox from '@components/ChatBox';
import ChatList from '@components/ChatList';
import InviteChannelModal from '@components/InviteChannelModal';
import PinnedPanel from '@components/PinnedPanel';
import ThreadPanel from '@components/ThreadPanel';
import TypingIndicator from '@components/TypingIndicator';
import ConversationIntro from '@components/ConversationIntro';
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
import { ArchivedNotice, Header, Container, DragOver, HeaderButton, Layout } from '@pages/Channel/styles';
import ChannelSettingsModal from '@components/ChannelSettingsModal';
import { moveChannelKeys } from '@utils/storageKeys';
import { IChannel, IChat, IDM, IReaction, IUser } from '@typings/db';
import { createTempId, cursorPageKey, isTempId, removeChatFromPages, updateChatInPages } from '@utils/chatPages';
import fetcher from '@utils/fetcher';
import getErrorMessage from '@utils/getErrorMessage';
import { toGifContent } from '@utils/gif';
import makeSection from '@utils/makeSection';
import prependChat from '@utils/prependChat';
import axios from 'axios';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Scrollbars } from 'react-custom-scrollbars-2';
import { useParams } from 'react-router';
import { Redirect, useHistory } from 'react-router-dom';
import { toast } from 'react-toastify';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';

const PAGE_SIZE = 20;
// 내가 보낸 파일 메시지는 낙관적 업데이트가 없으므로 소켓으로 받은 것을 그대로 표시한다
const isFileMessage = (content: string) => content.startsWith('file:');
const showError = (error: unknown) => toast.error(getErrorMessage(error), { position: 'bottom-center' });

const Channel = () => {
  const { workspace, channel } = useParams<{ workspace: string; channel: string }>();
  const history = useHistory();
  const [socket] = useSocket(workspace);
  const { data: userData } = useSWR<IUser>('/api/users', fetcher);
  const { data: channelsData, mutate: mutateChannels } = useSWR<IChannel[]>(
    `/api/workspaces/${workspace}/channels`,
    fetcher,
  );
  const channelData = channelsData?.find((v) => v.name === channel);
  const {
    data: chatData,
    mutate: mutateChat,
    setSize,
  } = useSWRInfinite<IChat[]>(
    cursorPageKey(`/api/workspaces/${workspace}/channels/${channel}/chats`, PAGE_SIZE),
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
  const { data: channelMembersData } = useSWR<IUser[]>(
    userData ? `/api/workspaces/${workspace}/channels/${channel}/members` : null,
    fetcher,
  );
  // 쓰다 만 메시지는 대화별로 임시 저장된다
  const [chat, setChat] = useDraft(draftKey(workspace, `channel:${channel}`));
  const onChangeChat = useCallback((e: { target: { value: string } }) => setChat(e.target.value), [setChat]);
  const [showInviteChannelModal, setShowInviteChannelModal] = useState(false);
  const [threadParentId, setThreadParentId] = useState<number | null>(null);
  const [showPinned, setShowPinned] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const scrollbarRef = useRef<Scrollbars>(null);
  const [dragOver, setDragOver] = useState(false);
  const { typingUsers, notifyTyping, clearTypingUser } = useTyping({
    socket,
    nickname: userData?.nickname,
    channelId: channelData?.id,
  });

  const isEmpty = chatData?.[0]?.length === 0;
  const isReachingEnd = isEmpty || (chatData && chatData[chatData.length - 1]?.length < PAGE_SIZE);
  const chatsKey = `/api/workspaces/${workspace}/channels/${channel}/chats`;

  const onOpenThread = useCallback((parentId: number) => {
    setShowPinned(false);
    setThreadParentId(parentId);
  }, []);
  useJumpToMessage({ pages: chatData, isReachingEnd, setSize, scrollbarRef, onOpenThread });

  // 들어오기 전에 읽지 않은 첫 메시지 위에 '새 메시지' 구분선
  const isMineChat = useCallback((c: IChat) => c.UserId === userData?.id, [userData?.id]);
  const firstUnreadId = useFirstUnread(
    `${workspace}-${channel}`,
    chatData,
    isMineChat,
    scrollbarRef,
    isReachingEnd,
    setSize,
  );

  // 입력창이 비어 있을 때 ↑ : 내 마지막 (글) 메시지를 수정
  const onEditLast = useCallback(() => {
    const last = chatData
      ?.flat()
      .find(
        (c) =>
          c.UserId === userData?.id &&
          !isTempId(c.id) &&
          !c.content.startsWith('file:') &&
          !c.content.startsWith('gif:'),
      );
    if (last) {
      document.querySelector(`[data-chat-id="${last.id}"]`)?.scrollIntoView({ block: 'nearest' });
      requestEdit(last.id);
    }
  }, [chatData, userData?.id]);

  // Esc : 스레드·고정 메시지 패널 닫기
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (canClosePanelWithEscape(e)) {
        setThreadParentId(null);
        setShowPinned(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // 채널을 옮기면 열려 있던 패널을 닫는다
  useEffect(() => {
    setThreadParentId(null);
    setShowPinned(false);
  }, [workspace, channel]);

  const onCloseModal = useCallback(() => {
    setShowInviteChannelModal(false);
  }, []);

  const onChangeChatWithTyping = useCallback(
    (e) => {
      onChangeChat(e);
      notifyTyping();
    },
    [onChangeChat, notifyTyping],
  );

  // 텍스트 메시지와 GIF 가 함께 쓰는 전송 로직 (낙관적 업데이트 후 서버 응답으로 교체)
  const sendMessage = useCallback(
    (content: string) => {
      if (!chatData || !channelData || !userData) {
        return;
      }
      const tempId = createTempId();
      mutateChat(
        (prevChatData) =>
          prependChat(prevChatData, {
            id: tempId,
            content,
            UserId: userData.id,
            User: userData,
            createdAt: new Date(),
            ChannelId: channelData.id,
            Channel: channelData,
            Reactions: [],
            replyCount: 0,
          }),
        false,
      ).then(() => {
        localStorage.setItem(`${workspace}-${channel}`, new Date().getTime().toString());
        scrollbarRef.current?.scrollToBottom();
      });
      axios
        .post<IChat>(chatsKey, { content })
        .then(({ data }) => {
          // 임시 메시지를 서버가 저장한 메시지로 바꿔야 바로 수정/삭제할 수 있다
          mutateChat((pages) => updateChatInPages(pages, tempId, () => data), false);
        })
        .catch((error) => {
          mutateChat((pages) => removeChatFromPages(pages, tempId), false);
          showError(error);
        });
    },
    [workspace, channel, channelData, userData, chatData, mutateChat, chatsKey],
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
        .post(`/api/workspaces/${workspace}/scheduled`, { ...{ channel }, content: chat, sendAt: date.toISOString() })
        .then(() => {
          setChat('');
          toast.success(`${formatWhen(date)}에 보낼게요.`, { position: 'bottom-center' });
        })
        .catch((error) => toast.error(getErrorMessage(error), { position: 'bottom-center' }));
    },
    [workspace, channel, chat, setChat],
  );

  const onMessage = useCallback(
    (data: IChat) => {
      if (data.Channel?.name !== channel) {
        return;
      }
      clearTypingUser(data.UserId);
      // 보고 있는 동안 받은 메시지는 읽은 것으로 기록 (나중에 안 읽음으로 다시 잡히지 않게)
      localStorage.setItem(`${workspace}-${channel}`, new Date().getTime().toString());
      // 스레드 답글이면 원본 메시지의 답글 수만 올린다 (답글 목록은 스레드 패널이 처리)
      if (data.ParentId) {
        mutateChat(
          (pages) =>
            updateChatInPages(pages, data.ParentId!, (parent) => ({
              ...parent,
              replyCount: (parent.replyCount || 0) + 1,
            })),
          false,
        );
        return;
      }
      if (!isFileMessage(data.content) && data.UserId === userData?.id) {
        return;
      }
      mutateChat((chatData) => prependChat(chatData, data), false).then(() => {
        if (scrollbarRef.current) {
          if (
            scrollbarRef.current.getScrollHeight() <
            scrollbarRef.current.getClientHeight() + scrollbarRef.current.getScrollTop() + 150
          ) {
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
    },
    [workspace, channel, userData, mutateChat, clearTypingUser],
  );

  const onMessageUpdated = useCallback(
    (data: IChat) => {
      if (data.ChannelId === channelData?.id && !data.ParentId) {
        mutateChat((pages) => updateChatInPages(pages, data.id, () => data), false);
      }
    },
    [channelData, mutateChat],
  );

  const onMessageDeleted = useCallback(
    (data: { id: number; ChannelId: number; ParentId: number | null }) => {
      if (data.ChannelId !== channelData?.id) {
        return;
      }
      if (data.ParentId) {
        mutateChat(
          (pages) =>
            updateChatInPages(pages, data.ParentId!, (parent) => ({
              ...parent,
              replyCount: Math.max((parent.replyCount || 1) - 1, 0),
            })),
          false,
        );
        return;
      }
      mutateChat((pages) => removeChatFromPages(pages, data.id), false);
      setThreadParentId((current) => (current === data.id ? null : current));
    },
    [channelData, mutateChat],
  );

  const onReactionUpdated = useCallback(
    (data: { id: number; ChannelId: number; ParentId: number | null; Reactions: IReaction[] }) => {
      if (data.ChannelId === channelData?.id && !data.ParentId) {
        mutateChat((pages) => updateChatInPages(pages, data.id, (c) => ({ ...c, Reactions: data.Reactions })), false);
      }
    },
    [channelData, mutateChat],
  );

  useEffect(() => {
    socket?.on('message', onMessage);
    socket?.on('messageUpdated', onMessageUpdated);
    socket?.on('messageDeleted', onMessageDeleted);
    socket?.on('reactionUpdated', onReactionUpdated);
    return () => {
      socket?.off('message', onMessage);
      socket?.off('messageUpdated', onMessageUpdated);
      socket?.off('messageDeleted', onMessageDeleted);
      socket?.off('reactionUpdated', onReactionUpdated);
    };
  }, [socket, onMessage, onMessageUpdated, onMessageDeleted, onReactionUpdated]);

  useEffect(() => {
    localStorage.setItem(`${workspace}-${channel}`, new Date().getTime().toString());
  }, [workspace, channel]);

  // 채널을 보고 있으면 그 채널에서 받은 멘션은 읽음 처리 (들어올 때 + 보고 있는 중에 새 멘션이 올 때)
  const markMentionsRead = useCallback(() => {
    if (channelData) {
      axios.post(`/api/workspaces/${workspace}/mentions/read`, { channelId: channelData.id }).catch(() => undefined);
    }
  }, [workspace, channelData]);

  useEffect(() => {
    markMentionsRead();
  }, [markMentionsRead]);

  useEffect(() => {
    const onMention = ({ chat }: { chat: IChat }) => {
      if (chat.ChannelId === channelData?.id) {
        markMentionsRead();
      }
    };
    socket?.on('mention', onMention);
    return () => {
      socket?.off('mention', onMention);
    };
  }, [socket, channelData, markMentionsRead]);

  // 메시지 액션 (본문과 스레드 패널이 함께 사용). 화면 갱신은 소켓 이벤트로 처리한다.
  const actions: ChatActions = useMemo(
    () => ({
      onEdit: (target: IDM | IChat, content: string) =>
        axios.patch(`${chatsKey}/${target.id}`, { content }).catch((error) => {
          showError(error);
          throw error;
        }),
      onDelete: (target: IDM | IChat) => {
        axios.delete(`${chatsKey}/${target.id}`).catch(showError);
      },
      onReact: (target: IDM | IChat, emoji: string) => {
        axios.post(`${chatsKey}/${target.id}/reactions`, { emoji }).catch(showError);
      },
      onReply: (target: IChat) => {
        setShowPinned(false);
        setThreadParentId(target.id);
      },
      onTogglePin: (target: IDM | IChat) => {
        const request = target.pinned
          ? axios.delete(`${chatsKey}/${target.id}/pin`)
          : axios.post(`${chatsKey}/${target.id}/pin`);
        request.catch(showError);
      },
    }),
    [chatsKey],
  );

  const onClickInviteChannel = useCallback(() => {
    setShowInviteChannelModal(true);
  }, []);

  const onTogglePinnedPanel = useCallback(() => {
    setThreadParentId(null);
    setShowPinned((prev) => !prev);
  }, []);

  const onLeaveChannel = useCallback(() => {
    axios
      .delete(`/api/workspaces/${workspace}/channels/${channel}/members/me`)
      .then(() => {
        mutateChannels((prev) => prev?.filter((c) => c.name !== channel), false);
        toast.info(`#${channel} 채널에서 나갔습니다.`, { position: 'bottom-center' });
        history.push(`/workspace/${workspace}/channel/일반`);
      })
      .catch(showError);
  }, [workspace, channel, mutateChannels, history]);

  // 이름을 바꾸면 이 기기의 읽은 시각/임시 저장 글을 옮기고 새 주소로 이동한다
  const onRenamed = useCallback(
    (newName: string) => {
      moveChannelKeys(workspace, channel, newName);
      mutateChannels().then(() => history.replace(`/workspace/${workspace}/channel/${newName}`));
    },
    [workspace, channel, mutateChannels, history],
  );

  // 채널 알림 끄기/켜기: 안 읽은 표시를 숨기고 멘션만 알린다
  const onToggleMute = useCallback(() => {
    if (!channelData) {
      return;
    }
    const muted = !channelData.muted;
    const muteUrl = `/api/workspaces/${workspace}/channels/${channel}/mute`;
    (muted ? axios.put(muteUrl) : axios.delete(muteUrl))
      .then(() => {
        mutateChannels((prev) => prev?.map((c) => (c.id === channelData.id ? { ...c, muted } : c)), false);
        toast.info(muted ? `#${channel} 알림을 껐습니다. 멘션은 계속 알려드려요.` : `#${channel} 알림을 켰습니다.`, {
          position: 'bottom-center',
        });
      })
      .catch(showError);
  }, [workspace, channel, channelData, mutateChannels]);

  const onUploaded = useCallback(() => {
    localStorage.setItem(`${workspace}-${channel}`, new Date().getTime().toString());
  }, [workspace, channel]);
  const { upload, uploading, progress } = useFileUpload(
    `/api/workspaces/${workspace}/channels/${channel}/files`,
    onUploaded,
  );

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

  // 채널 이름 변경·보관·삭제 권한: 채널을 만든 사람 또는 워크스페이스 소유자
  const currentWorkspace = userData?.Workspaces?.find((w) => w.url === workspace);
  const canManage = !!userData && (channelData?.OwnerId === userData.id || currentWorkspace?.OwnerId === userData.id);

  if (channelsData && !channelData) {
    return <Redirect to={`/workspace/${workspace}/channel/일반`} />;
  }

  const chatSections = makeSection(chatData ? ([] as IChat[]).concat(...chatData).reverse() : []);
  const threadParent = threadParentId ? chatData?.flat().find((c) => c.id === threadParentId) : undefined;

  return (
    <Layout>
      <Container onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}>
        <Header>
          <span className="name" title={channelData?.private ? '비공개 채널' : '공개 채널'}>
            {channelData?.private ? '🔒 ' : '#'}
            {channel}
          </span>
          {channelData?.archived && <span className="archived">🗄 보관됨</span>}
          {channelData?.topic && (
            <button type="button" className="topic" title={channelData.topic} onClick={() => setShowSettings(true)}>
              {channelData.topic}
            </button>
          )}
          <div style={{ display: 'flex', flex: 1, justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
            <HeaderButton type="button" onClick={() => setShowSettings(true)} title="채널 설정">
              ⚙ 설정
            </HeaderButton>
            <HeaderButton
              type="button"
              className={showPinned ? 'active' : undefined}
              onClick={onTogglePinnedPanel}
              title="고정된 메시지"
            >
              📌 고정
            </HeaderButton>
            <HeaderButton
              type="button"
              className={channelData?.muted ? 'active' : undefined}
              onClick={onToggleMute}
              title={channelData?.muted ? '알림 켜기' : '알림 끄기 (멘션은 계속 알림)'}
              aria-pressed={!!channelData?.muted}
            >
              {channelData?.muted ? '🔕 알림 꺼짐' : '🔔 알림'}
            </HeaderButton>
            {channel !== '일반' && (
              <HeaderButton type="button" onClick={onLeaveChannel} title="채널 나가기">
                나가기
              </HeaderButton>
            )}
            <span>{channelMembersData?.length}</span>
            <button
              onClick={onClickInviteChannel}
              className="c-button-unstyled p-ia__view_header__button"
              aria-label="채널에 사람 초대"
              data-sk="tooltip_parent"
              type="button"
            >
              <i className="c-icon p-ia__view_header__button_icon c-icon--add-user" aria-hidden="true" />
            </button>
          </div>
        </Header>
        <ChatList
          scrollbarRef={scrollbarRef}
          isReachingEnd={isReachingEnd}
          isEmpty={isEmpty}
          chatSections={chatSections}
          setSize={setSize}
          myId={userData?.id}
          actions={actions}
          firstUnreadId={firstUnreadId}
          intro={
            <ConversationIntro
              icon={channelData?.private ? '🔒' : '#'}
              title={`${channelData?.private ? '🔒 ' : '#'}${channel} 채널의 시작`}
              description={
                channelData?.private
                  ? '초대받은 멤버만 볼 수 있는 비공개 채널입니다.'
                  : '워크스페이스의 누구나 참여할 수 있는 공개 채널입니다.'
              }
            />
          }
        />
        <TypingIndicator names={typingUsers} />
        <ScheduledBar workspace={workspace} channel={channel} />
        <PollModal show={showPollModal} onCloseModal={() => setShowPollModal(false)} onCreate={onCreatePoll} />
        {channelData?.archived ? (
          <ArchivedNotice role="status">
            🗄 보관된 채널입니다. 메시지를 읽을 수만 있어요.
            {canManage && (
              <button type="button" onClick={() => setShowSettings(true)}>
                채널 설정
              </button>
            )}
          </ArchivedNotice>
        ) : (
          <ChatBox
            onSubmitForm={onSubmitForm}
            chat={chat}
            onChangeChat={onChangeChatWithTyping}
            placeholder={`${channelData?.private ? '🔒' : '#'}${channel}에 메시지 보내기`}
            data={channelMembersData}
            allowBroadcast
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
        )}
        {channelData && workspace && (
          <ChannelSettingsModal
            show={showSettings}
            workspace={workspace}
            channel={channelData}
            canManage={canManage}
            onCloseModal={() => setShowSettings(false)}
            onRenamed={onRenamed}
            onDeleted={() => history.push(`/workspace/${workspace}/channel/일반`)}
          />
        )}
        <InviteChannelModal
          show={showInviteChannelModal}
          onCloseModal={onCloseModal}
          setShowInviteChannelModal={setShowInviteChannelModal}
        />
        {dragOver && <DragOver>여기에 놓아서 파일 보내기</DragOver>}
      </Container>
      {threadParent && userData && (
        <ThreadPanel
          key={threadParent.id}
          workspace={workspace}
          channel={channel}
          parent={threadParent}
          me={userData}
          members={channelMembersData}
          socket={socket}
          actions={actions}
          onClose={() => setThreadParentId(null)}
        />
      )}
      {showPinned && userData && (
        <PinnedPanel
          pinnedUrl={`/api/workspaces/${workspace}/channels/${channel}/pinned`}
          revalidateOn={['messageUpdated', 'messageDeleted', 'reactionUpdated']}
          myId={userData.id}
          socket={socket}
          actions={actions}
          onClose={() => setShowPinned(false)}
        />
      )}
    </Layout>
  );
};

export default Channel;
