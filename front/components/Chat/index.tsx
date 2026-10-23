import {
  Bell,
  Bookmark,
  Bot,
  CornerUpRight,
  Link,
  MessageSquareReply,
  Pencil,
  Pin,
  SmilePlus,
  Trash2,
} from 'lucide-react';
import {
  ActionBar,
  ChatWrapper,
  ConfirmBox,
  FullPicker,
  PresetMenu,
  EditBox,
  EmojiPicker,
  PinnedLabel,
  ReactionList,
  ReplyLink,
} from '@components/Chat/styles';
import { IChat, IDM, IUser } from '@typings/db';
import { isTempId } from '@utils/chatPages';
import { parseGifContent } from '@utils/gif';
import { renderMarkdown } from '@utils/markdown';
import { firstLink } from '@utils/links';
import LinkPreview from '@components/LinkPreview';
import ForwardedCard from '@components/ForwardedCard';
import ForwardModal from '@components/ForwardModal';
import { parseForwardContent } from '@utils/forward';
import { parseFileContent } from '@utils/fileStore';
import FileAttachment from '@components/FileAttachment';
import dayjs from 'dayjs';
import { avatarUrl } from '@utils/avatar';
import React, { FC, useMemo, memo, useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router';
import useSWR from 'swr';
import fetcher from '@utils/fetcher';
import useSaved, { useToggleSaved } from '@hooks/useSaved';
import { toast } from 'react-toastify';
import { subscribeEditRequest } from '@utils/editRequest';
import PollView from '@components/PollView';
import EditHistoryModal from '@components/EditHistoryModal';
import EmojiPanel from '@components/EmojiPanel';
import useCustomEmojis from '@hooks/useCustomEmojis';
import { parsePollContent, POLL_EMOJIS } from '@utils/poll';
import { formatWhen, timePresets } from '@utils/timePresets';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';

export const EMOJIS = ['👍', '❤️', '😂', '🎉', '😮', '👀'];

export interface ChatActions {
  onEdit?: (chat: IDM | IChat, content: string) => Promise<unknown>;
  onDelete?: (chat: IDM | IChat) => void;
  onReact?: (chat: IDM | IChat, emoji: string) => void;
  onReply?: (chat: IChat) => void;
  onTogglePin?: (chat: IDM | IChat) => void;
}

interface Props {
  data: IDM | IChat;
  myId?: number;
  actions?: ChatActions;
}

// 예전에 서버에 업로드하던 방식의 첨부 (서버 저장을 없애서 더 이상 볼 수 없음)
const isLegacyUpload = (content: string) => content.startsWith('uploads\\') || content.startsWith('uploads/');

const Chat: FC<Props> = memo(({ data, myId, actions }) => {
  const { workspace, channel } = useParams<{ workspace: string; channel?: string }>();
  const isDM = 'Sender' in data;
  // 저장 여부는 레이아웃의 🔖 버튼이 불러온 목록 캐시만 읽는다
  const { ids: savedIds } = useSaved(workspace, false);
  const isSaved = isDM ? savedIds.dms.has(data.id) : savedIds.chats.has(data.id);
  const toggleSaved = useToggleSaved(workspace);
  // 수신 웹훅 메시지는 사람 대신 이름(botName)으로 보낸다
  const botName = 'Sender' in data ? null : data.User ? null : data.botName || '앱';
  const sender: IUser = useMemo(
    () =>
      'Sender' in data
        ? data.Sender
        : data.User || ({ id: 0, nickname: botName || '앱', email: `bot:${botName}`, Workspaces: [] } as IUser),
    [data, botName],
  );
  // 메시지에 담긴 보낸 사람 정보는 보낼 당시 것이라, 닉네임/프로필 그림은 최신 멤버 목록 값을 쓴다
  // (멤버 목록은 워크스페이스 레이아웃이 불러오고 profileUpdated 때 갱신하므로 여기서는 캐시만 읽는다)
  const { data: members } = useSWR<IUser[]>(workspace ? `/api/workspaces/${workspace}/members` : null, fetcher, {
    revalidateOnMount: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
  const user = useMemo(() => {
    const latest = sender && members?.find((m) => m.id === sender.id);
    return latest
      ? {
          ...sender,
          nickname: latest.nickname,
          avatarStyle: latest.avatarStyle,
          statusEmoji: latest.statusEmoji,
          statusText: latest.statusText,
        }
      : sender;
  }, [sender, members]);
  const channelChat = 'Sender' in data ? null : (data as IChat);
  const isMine = myId !== undefined && user?.id === myId;
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [showFullPicker, setShowFullPicker] = useState(false);
  // 커스텀 이모지 (레이아웃이 불러온 캐시만 읽는다)
  const { map: emojiMap } = useCustomEmojis(workspace, false);
  const [showHistory, setShowHistory] = useState(false);

  const gifUrl = useMemo(() => parseGifContent(data.content), [data.content]);
  const poll = useMemo(() => parsePollContent(data.content), [data.content]);
  const fileMeta = useMemo(() => parseFileContent(data.content), [data.content]);
  const forwarded = useMemo(() => parseForwardContent(data.content), [data.content]);
  const link = useMemo(
    () =>
      gifUrl || poll || fileMeta ? null : firstLink(forwarded ? `${forwarded.c}\n${forwarded.m.t}` : data.content),
    [data.content, gifUrl, poll, fileMeta, forwarded],
  );
  const [showForward, setShowForward] = useState(false);
  const result = useMemo<React.ReactNode>(
    () =>
      gifUrl ? (
        <img src={gifUrl} alt="GIF" style={{ maxHeight: 200, maxWidth: '100%', borderRadius: 4 }} />
      ) : fileMeta ? (
        <FileAttachment meta={fileMeta} sentAt={data.createdAt} />
      ) : forwarded ? (
        <>
          {forwarded.c && renderMarkdown(forwarded.c, workspace, emojiMap)}
          <ForwardedCard forwarded={forwarded} workspace={workspace} emojis={emojiMap} />
        </>
      ) : isLegacyUpload(data.content) ? (
        <span style={{ color: 'var(--text-muted)' }}>
          [이전 방식으로 서버에 올린 첨부파일 - 더 이상 볼 수 없습니다]
        </span>
      ) : (
        renderMarkdown(data.content, workspace, emojiMap)
      ),
    [workspace, data.content, gifUrl, fileMeta, forwarded, data.createdAt, emojiMap],
  );

  // 같은 이모지끼리 묶어서 개수와 내가 눌렀는지 표시 (채널 메시지, DM 모두)
  const reactionGroups = useMemo(() => {
    const groups: { emoji: string; count: number; mine: boolean }[] = [];
    data.Reactions?.forEach((reaction) => {
      // 투표 메시지의 선택지 번호 이모지는 투표 결과로만 보여준다
      if (poll && POLL_EMOJIS.includes(reaction.emoji)) {
        return;
      }
      const group = groups.find((g) => g.emoji === reaction.emoji);
      if (group) {
        group.count += 1;
        group.mine = group.mine || reaction.UserId === myId;
      } else {
        groups.push({ emoji: reaction.emoji, count: 1, mine: reaction.UserId === myId });
      }
    });
    return groups;
  }, [data.Reactions, myId, poll]);

  const onStartEdit = useCallback(() => {
    setEditText(data.content);
    setEditing(true);
  }, [data.content]);

  // 입력창에서 ↑ 를 누르면 (내 마지막 메시지인) 이 메시지를 수정 모드로 연다
  useEffect(
    () =>
      subscribeEditRequest((id) => {
        if (id === data.id) {
          onStartEdit();
        }
      }),
    [data.id, onStartEdit],
  );

  const onSaveEdit = useCallback(() => {
    const content = editText.trim();
    if (!content || !actions?.onEdit) {
      return;
    }
    if (content === data.content) {
      setEditing(false);
      return;
    }
    actions.onEdit(data, content).then(() => setEditing(false));
  }, [editText, actions, data]);

  const onEditKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.nativeEvent.isComposing) {
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSaveEdit();
      } else if (e.key === 'Escape') {
        setEditing(false);
      }
    },
    [onSaveEdit],
  );

  const onPickEmoji = useCallback(
    (emoji: string) => {
      if (actions?.onReact) {
        actions.onReact(data, emoji);
      }
      setShowPicker(false);
    },
    [data, actions],
  );

  if (!user) {
    return null;
  }

  // 전송 중(임시 id)인 메시지에는 액션을 보여주지 않는다
  const canAct = !!actions && !isTempId(data.id);
  const canEdit =
    canAct &&
    isMine &&
    !!actions?.onEdit &&
    !gifUrl &&
    !fileMeta &&
    !poll &&
    !forwarded &&
    !isLegacyUpload(data.content);
  // 파일(보낸 사람 기기에만 있음)·투표는 전달하지 않는다
  const canForward = canAct && !!workspace && !fileMeta && !poll && !isLegacyUpload(data.content);
  const canRemind = canAct && !!workspace;

  // 리액션 이모지: 커스텀(:이름:)이면 그림
  const renderReactionEmoji = (emoji: string) => {
    const custom = /^:([a-z0-9_-]+):$/.exec(emoji);
    return custom && emojiMap[custom[1]] ? (
      <img className="custom-emoji" src={emojiMap[custom[1]]} alt={emoji} title={emoji} />
    ) : (
      emoji
    );
  };

  // 투표 마감 (올린 사람만): 수정 내역 주소와 같은 경로 아래의 poll/close
  const onClosePoll = () => {
    axios
      .post(historyUrl.replace(/\/history$/, '/poll/close'))
      .then(() => toast.info('투표를 마감했습니다.', { position: 'bottom-center' }))
      .catch((error) => toast.error(getErrorMessage(error), { position: 'bottom-center' }));
  };

  // 리마인더: 정한 시각에 이 메시지를 다시 알려준다
  const onRemind = (date: Date) => {
    setShowReminder(false);
    axios
      .post(`/api/workspaces/${workspace}/reminders`, {
        [isDM ? 'dmId' : 'chatId']: data.id,
        remindAt: date.toISOString(),
      })
      .then(() => toast.info(`${formatWhen(date)}에 이 메시지를 다시 알려드릴게요.`, { position: 'bottom-center' }))
      .catch((error) => toast.error(getErrorMessage(error), { position: 'bottom-center' }));
  };
  const canDelete = canAct && isMine && !!actions?.onDelete;
  const canReact = canAct && !!actions?.onReact;
  const canReply = canAct && !!channelChat && !channelChat.ParentId && !!actions?.onReply;
  const canPin = canAct && !!actions?.onTogglePin;
  const canSave = canAct && !!workspace;
  // 메시지 링크는 채널 메시지만 (DM 주소는 보는 사람마다 달라서 공유할 수 없다)
  const linkChannel = channelChat?.Channel?.name || channel;
  // 수정 내역 주소 (채널 메시지면 채널 이름, DM 이면 대화 상대 id 로)
  const historyUrl = !workspace
    ? ''
    : isDM
    ? `/api/workspaces/${workspace}/dms/${
        (data as IDM).SenderId === myId ? (data as IDM).ReceiverId : (data as IDM).SenderId
      }/chats/${data.id}/history`
    : linkChannel
    ? `/api/workspaces/${workspace}/channels/${encodeURIComponent(linkChannel)}/chats/${data.id}/history`
    : '';
  const canCopyLink = canAct && !!channelChat && !!linkChannel;

  const onCopyLink = () => {
    if (!channelChat || !linkChannel) {
      return;
    }
    const query = channelChat.ParentId
      ? `message=${channelChat.ParentId}&reply=${channelChat.id}`
      : `message=${channelChat.id}`;
    const url = `${window.location.origin}/workspace/${workspace}/channel/${encodeURIComponent(linkChannel)}?${query}`;
    navigator.clipboard
      ?.writeText(url)
      .then(() => toast.info('메시지 링크를 복사했습니다.', { position: 'bottom-center' }))
      .catch(() => toast.error('링크를 복사하지 못했습니다.', { position: 'bottom-center' }));
  };

  return (
    <ChatWrapper
      className={data.pinned ? 'pinned' : undefined}
      data-chat-id={data.id}
      onMouseLeave={() => {
        setShowPicker(false);
        setShowReminder(false);
        setShowFullPicker(false);
      }}
    >
      <div className="chat-img">
        {botName ? (
          <span className="bot-avatar" aria-hidden="true">
            <Bot size={22} />
          </span>
        ) : (
          <img src={avatarUrl(user, 36)} alt={user.nickname} />
        )}
      </div>
      <div className="chat-text">
        {(data.pinned || isSaved) && (
          <PinnedLabel>
            {data.pinned && (
              <>
                <Pin size={12} /> 고정됨
              </>
            )}
            {data.pinned && isSaved && ' · '}
            {isSaved && (
              <span className="saved">
                <Bookmark size={12} /> 저장됨
              </span>
            )}
          </PinnedLabel>
        )}
        <div className="chat-user">
          <b>{user.nickname}</b>
          {botName && <span className="bot-badge">앱</span>}
          {user.statusEmoji && (
            <span className="status" title={user.statusText || undefined}>
              {user.statusEmoji}
            </span>
          )}
          <span>{dayjs(data.createdAt).format('h:mm A')}</span>
          {data.editedAt && (
            <button
              type="button"
              className="edited"
              title="수정 내역 보기"
              onClick={() => setShowHistory(true)}
              disabled={!historyUrl}
            >
              (수정됨)
            </button>
          )}
        </div>
        {editing ? (
          <EditBox data-editing="true">
            <textarea
              autoFocus
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={onEditKeyDown}
              aria-label="메시지 수정"
            />
            <div>
              <span>Enter 저장 · Esc 취소</span>
              <button type="button" onClick={() => setEditing(false)}>
                취소
              </button>
              <button type="button" className="primary" onClick={onSaveEdit} disabled={!editText.trim()}>
                저장
              </button>
            </div>
          </EditBox>
        ) : // 코드 블록/인용/파일 카드는 블록 요소라 <p> 대신 <div> 로 감싼다
        poll ? (
          <PollView
            poll={poll}
            reactions={data.Reactions}
            myId={myId}
            members={members}
            onVote={canReact ? (emoji) => onPickEmoji(emoji) : undefined}
            onClosePoll={isMine && canAct && historyUrl ? onClosePoll : undefined}
          />
        ) : (
          <div className={fileMeta ? 'attachment' : 'message-body'}>{result}</div>
        )}
        {link && !editing && workspace && <LinkPreview workspace={workspace} url={link} />}
        {reactionGroups.length > 0 && (
          <ReactionList>
            {reactionGroups.map((group) => (
              <button
                key={group.emoji}
                type="button"
                className={group.mine ? 'mine' : undefined}
                onClick={() => canReact && onPickEmoji(group.emoji)}
                title={`${group.count}명${group.mine ? ' (나 포함)' : ''}`}
              >
                {renderReactionEmoji(group.emoji)} {group.count}
              </button>
            ))}
          </ReactionList>
        )}
        {canReply && !!channelChat?.replyCount && (
          <ReplyLink type="button" onClick={() => actions?.onReply?.(channelChat)}>
            답글 {channelChat.replyCount}개
          </ReplyLink>
        )}
        {confirmDelete && (
          <ConfirmBox>
            <span>이 메시지를 삭제할까요?{canReply && channelChat?.replyCount ? ' 답글도 함께 삭제됩니다.' : ''}</span>
            <button type="button" onClick={() => setConfirmDelete(false)}>
              취소
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => {
                setConfirmDelete(false);
                actions?.onDelete?.(data);
              }}
            >
              삭제
            </button>
          </ConfirmBox>
        )}
      </div>
      {canAct && !editing && (
        <ActionBar className="chat-actions">
          {canReact && (
            <button type="button" title="리액션 추가" aria-label="리액션 추가" onClick={() => setShowPicker((v) => !v)}>
              <SmilePlus size={16} />
            </button>
          )}
          {canReply && (
            <button
              type="button"
              title="스레드로 답글"
              aria-label="스레드로 답글"
              onClick={() => actions?.onReply?.(channelChat!)}
            >
              <MessageSquareReply size={16} />
            </button>
          )}
          {canPin && (
            <button
              type="button"
              title={data.pinned ? '고정 해제' : '고정'}
              aria-label={data.pinned ? '고정 해제' : '고정'}
              onClick={() => actions?.onTogglePin?.(data)}
            >
              <Pin size={16} />
            </button>
          )}
          {canSave && (
            <button
              type="button"
              title={isSaved ? '저장 취소' : '나중에 보기로 저장'}
              aria-label={isSaved ? '저장 취소' : '저장'}
              aria-pressed={isSaved}
              onClick={() => toggleSaved(isDM ? 'dms' : 'chats', data.id, isSaved)}
            >
              <Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} />
            </button>
          )}
          {canRemind && (
            <button
              type="button"
              title="나중에 다시 알림"
              aria-label="리마인더"
              aria-expanded={showReminder}
              onClick={() => {
                setShowPicker(false);
                setShowReminder((v) => !v);
              }}
            >
              <Bell size={16} />
            </button>
          )}
          {canForward && (
            <button
              type="button"
              title="다른 채널·사람에게 전달"
              aria-label="전달"
              onClick={() => setShowForward(true)}
            >
              <CornerUpRight size={16} />
            </button>
          )}
          {canCopyLink && (
            <button type="button" title="메시지 링크 복사" aria-label="메시지 링크 복사" onClick={onCopyLink}>
              <Link size={16} />
            </button>
          )}
          {canEdit && (
            <button type="button" title="수정" aria-label="수정" onClick={onStartEdit}>
              <Pencil size={16} />
            </button>
          )}
          {canDelete && (
            <button type="button" title="삭제" aria-label="삭제" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={16} />
            </button>
          )}
          {showReminder && (
            <PresetMenu role="menu" aria-label="다시 알릴 시각">
              <div className="title">다시 알림</div>
              {timePresets().map((preset) => (
                <button key={preset.label} type="button" role="menuitem" onClick={() => onRemind(preset.date)}>
                  {preset.label}
                </button>
              ))}
            </PresetMenu>
          )}
          {showPicker && (
            <EmojiPicker>
              {EMOJIS.map((emoji) => (
                <button key={emoji} type="button" aria-label={`${emoji} 리액션`} onClick={() => onPickEmoji(emoji)}>
                  {emoji}
                </button>
              ))}
              <button
                type="button"
                aria-label="다른 이모지 고르기"
                title="다른 이모지"
                onClick={() => {
                  setShowPicker(false);
                  setShowFullPicker(true);
                }}
              >
                ＋
              </button>
            </EmojiPicker>
          )}
          {showFullPicker && (
            <FullPicker>
              <EmojiPanel
                onPick={(emoji) => {
                  setShowFullPicker(false);
                  onPickEmoji(emoji);
                }}
              />
            </FullPicker>
          )}
        </ActionBar>
      )}
      {showHistory && (
        <EditHistoryModal
          show={showHistory}
          historyUrl={historyUrl}
          workspace={workspace}
          onCloseModal={() => setShowHistory(false)}
        />
      )}
      {showForward && workspace && (
        <ForwardModal
          show={showForward}
          workspace={workspace}
          source={{
            source: isDM ? 'dm' : 'chat',
            id: data.id,
            content: data.content,
            author: user.nickname || channelChat?.botName || '',
          }}
          onClose={() => setShowForward(false)}
        />
      )}
    </ChatWrapper>
  );
});

export default Chat;
