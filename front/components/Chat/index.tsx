import {
  ActionBar,
  ChatWrapper,
  ConfirmBox,
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
  const sender: IUser = 'Sender' in data ? data.Sender : data.User;
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

  const gifUrl = useMemo(() => parseGifContent(data.content), [data.content]);
  const fileMeta = useMemo(() => parseFileContent(data.content), [data.content]);
  const result = useMemo<React.ReactNode>(
    () =>
      gifUrl ? (
        <img src={gifUrl} alt="GIF" style={{ maxHeight: 200, maxWidth: '100%', borderRadius: 4 }} />
      ) : fileMeta ? (
        <FileAttachment meta={fileMeta} sentAt={data.createdAt} />
      ) : isLegacyUpload(data.content) ? (
        <span style={{ color: 'var(--text-muted)' }}>
          [이전 방식으로 서버에 올린 첨부파일 - 더 이상 볼 수 없습니다]
        </span>
      ) : (
        renderMarkdown(data.content, workspace)
      ),
    [workspace, data.content, gifUrl, fileMeta, data.createdAt],
  );

  // 같은 이모지끼리 묶어서 개수와 내가 눌렀는지 표시 (채널 메시지, DM 모두)
  const reactionGroups = useMemo(() => {
    const groups: { emoji: string; count: number; mine: boolean }[] = [];
    data.Reactions?.forEach((reaction) => {
      const group = groups.find((g) => g.emoji === reaction.emoji);
      if (group) {
        group.count += 1;
        group.mine = group.mine || reaction.UserId === myId;
      } else {
        groups.push({ emoji: reaction.emoji, count: 1, mine: reaction.UserId === myId });
      }
    });
    return groups;
  }, [data.Reactions, myId]);

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
  const canEdit = canAct && isMine && !!actions?.onEdit && !gifUrl && !fileMeta && !isLegacyUpload(data.content);
  const canDelete = canAct && isMine && !!actions?.onDelete;
  const canReact = canAct && !!actions?.onReact;
  const canReply = canAct && !!channelChat && !channelChat.ParentId && !!actions?.onReply;
  const canPin = canAct && !!actions?.onTogglePin;
  const canSave = canAct && !!workspace;
  // 메시지 링크는 채널 메시지만 (DM 주소는 보는 사람마다 달라서 공유할 수 없다)
  const linkChannel = channelChat?.Channel?.name || channel;
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
      onMouseLeave={() => setShowPicker(false)}
    >
      <div className="chat-img">
        <img src={avatarUrl(user, 36)} alt={user.nickname} />
      </div>
      <div className="chat-text">
        {(data.pinned || isSaved) && (
          <PinnedLabel>
            {data.pinned && '📌 고정됨'}
            {data.pinned && isSaved && ' · '}
            {isSaved && <span className="saved">🔖 저장됨</span>}
          </PinnedLabel>
        )}
        <div className="chat-user">
          <b>{user.nickname}</b>
          {user.statusEmoji && (
            <span className="status" title={user.statusText || undefined}>
              {user.statusEmoji}
            </span>
          )}
          <span>{dayjs(data.createdAt).format('h:mm A')}</span>
          {data.editedAt && <span className="edited">(수정됨)</span>}
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
        ) : (
          // 코드 블록/인용/파일 카드는 블록 요소라 <p> 대신 <div> 로 감싼다
          <div className={fileMeta ? 'attachment' : 'message-body'}>{result}</div>
        )}
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
                {group.emoji} {group.count}
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
              😀
            </button>
          )}
          {canReply && (
            <button
              type="button"
              title="스레드로 답글"
              aria-label="스레드로 답글"
              onClick={() => actions?.onReply?.(channelChat!)}
            >
              💬
            </button>
          )}
          {canPin && (
            <button
              type="button"
              title={data.pinned ? '고정 해제' : '고정'}
              aria-label={data.pinned ? '고정 해제' : '고정'}
              onClick={() => actions?.onTogglePin?.(data)}
            >
              📌
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
              🔖
            </button>
          )}
          {canCopyLink && (
            <button type="button" title="메시지 링크 복사" aria-label="메시지 링크 복사" onClick={onCopyLink}>
              🔗
            </button>
          )}
          {canEdit && (
            <button type="button" title="수정" aria-label="수정" onClick={onStartEdit}>
              ✏️
            </button>
          )}
          {canDelete && (
            <button type="button" title="삭제" aria-label="삭제" onClick={() => setConfirmDelete(true)}>
              🗑️
            </button>
          )}
          {showPicker && (
            <EmojiPicker>
              {EMOJIS.map((emoji) => (
                <button key={emoji} type="button" aria-label={`${emoji} 리액션`} onClick={() => onPickEmoji(emoji)}>
                  {emoji}
                </button>
              ))}
            </EmojiPicker>
          )}
        </ActionBar>
      )}
    </ChatWrapper>
  );
});

export default Chat;
