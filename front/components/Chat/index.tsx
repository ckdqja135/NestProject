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
import dayjs from 'dayjs';
import gravatar from 'gravatar';
import React, { FC, useMemo, memo, useState, useCallback } from 'react';
import { useParams } from 'react-router';
import { Link } from 'react-router-dom';
import regexifyString from 'regexify-string';

export const EMOJIS = ['👍', '❤️', '😂', '🎉', '😮', '👀'];

export interface ChatActions {
  onEdit?: (chat: IDM | IChat, content: string) => Promise<unknown>;
  onDelete?: (chat: IDM | IChat) => void;
  onReact?: (chat: IChat, emoji: string) => void;
  onReply?: (chat: IChat) => void;
  onTogglePin?: (chat: IChat) => void;
}

interface Props {
  data: IDM | IChat;
  myId?: number;
  actions?: ChatActions;
}

const BACK_URL = process.env.NODE_ENV === 'development' ? 'http://localhost:3002' : 'https://sleact.nodebird.com';
const isImage = (content: string) => content.startsWith('uploads\\') || content.startsWith('uploads/');

const Chat: FC<Props> = memo(({ data, myId, actions }) => {
  const { workspace } = useParams<{ workspace: string; channel: string }>();
  const user: IUser = 'Sender' in data ? data.Sender : data.User;
  const channelChat = 'Sender' in data ? null : (data as IChat);
  const isMine = myId !== undefined && user?.id === myId;
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const result = useMemo<(string | JSX.Element)[] | JSX.Element>(
    () =>
      isImage(data.content) ? (
        <img src={`${BACK_URL}/${data.content}`} style={{ maxHeight: 200 }} />
      ) : (
        regexifyString({
          pattern: /@\[(.+?)]\((\d+?)\)|\n/g,
          decorator(match, index) {
            const arr: string[] | null = match.match(/@\[(.+?)]\((\d+?)\)/)!;
            if (arr) {
              return (
                <Link key={match + index} to={`/workspace/${workspace}/dm/${arr[2]}`}>
                  @{arr[1]}
                </Link>
              );
            }
            return <br key={index} />;
          },
          input: data.content,
        })
      ),
    [workspace, data.content],
  );

  // 같은 이모지끼리 묶어서 개수와 내가 눌렀는지 표시
  const reactionGroups = useMemo(() => {
    const groups: { emoji: string; count: number; mine: boolean }[] = [];
    channelChat?.Reactions?.forEach((reaction) => {
      const group = groups.find((g) => g.emoji === reaction.emoji);
      if (group) {
        group.count += 1;
        group.mine = group.mine || reaction.UserId === myId;
      } else {
        groups.push({ emoji: reaction.emoji, count: 1, mine: reaction.UserId === myId });
      }
    });
    return groups;
  }, [channelChat?.Reactions, myId]);

  const onStartEdit = useCallback(() => {
    setEditText(data.content);
    setEditing(true);
  }, [data.content]);

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
      if (channelChat && actions?.onReact) {
        actions.onReact(channelChat, emoji);
      }
      setShowPicker(false);
    },
    [channelChat, actions],
  );

  if (!user) {
    return null;
  }

  // 전송 중(임시 id)인 메시지에는 액션을 보여주지 않는다
  const canAct = !!actions && !isTempId(data.id);
  const canEdit = canAct && isMine && !!actions?.onEdit && !isImage(data.content);
  const canDelete = canAct && isMine && !!actions?.onDelete;
  const canReact = canAct && !!channelChat && !!actions?.onReact;
  const canReply = canAct && !!channelChat && !channelChat.ParentId && !!actions?.onReply;
  const canPin = canAct && !!channelChat && !!actions?.onTogglePin;

  return (
    <ChatWrapper className={channelChat?.pinned ? 'pinned' : undefined} onMouseLeave={() => setShowPicker(false)}>
      <div className="chat-img">
        <img src={gravatar.url(user.email, { s: '36px', d: 'retro' })} alt={user.nickname} />
      </div>
      <div className="chat-text">
        {channelChat?.pinned && <PinnedLabel>📌 고정됨</PinnedLabel>}
        <div className="chat-user">
          <b>{user.nickname}</b>
          <span>{dayjs(data.createdAt).format('h:mm A')}</span>
          {data.editedAt && <span className="edited">(수정됨)</span>}
        </div>
        {editing ? (
          <EditBox>
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
          <p>{result}</p>
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
              title={channelChat?.pinned ? '고정 해제' : '고정'}
              aria-label={channelChat?.pinned ? '고정 해제' : '고정'}
              onClick={() => actions?.onTogglePin?.(channelChat!)}
            >
              📌
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
