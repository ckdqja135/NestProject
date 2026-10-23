import useSocket from '@hooks/useSocket';
import { IUser } from '@typings/db';
import { avatarUrl } from '@utils/avatar';
import fetcher from '@utils/fetcher';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import dayjs from 'dayjs';
import { Check, CornerDownLeft, MessageSquare, Pencil, RotateCcw, Trash2, X } from 'lucide-react';
import React, { FC, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import useSWR from 'swr';
import { Panel } from './commentStyles';

export interface DocComment {
  id: number;
  threadId: string;
  content: string;
  quote: string | null;
  resolved: boolean;
  editedAt: string | null;
  createdAt: string;
  UserId: number | null;
  User: Pick<IUser, 'id' | 'nickname' | 'email' | 'avatarStyle'> | null;
}

interface Thread {
  id: string;
  quote: string | null;
  resolved: boolean;
  comments: DocComment[];
}

const newThreadId = () => `th-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;

const when = (iso: string) => {
  const d = dayjs(iso);
  return d.isSame(dayjs(), 'day') ? d.format('HH:mm') : d.format('M월 D일 HH:mm');
};

const showError = (error: unknown) => toast.error(getErrorMessage(error), { position: 'bottom-center' });

// 댓글 쓰는 칸 (Enter 로 보내고 Shift+Enter 로 줄바꿈)
const Composer: FC<{
  placeholder: string;
  autoFocus?: boolean;
  onSubmit: (text: string) => Promise<unknown>;
  onCancel?: () => void;
}> = ({ placeholder, autoFocus, onSubmit, onCancel }) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const send = () => {
    if (!text.trim() || sending) return;
    setSending(true);
    onSubmit(text.trim())
      .then(() => setText(''))
      .finally(() => setSending(false));
  };
  return (
    <div className="composer">
      <textarea
        value={text}
        autoFocus={autoFocus}
        rows={2}
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={4000}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
          }
          if (e.key === 'Escape' && onCancel) onCancel();
        }}
      />
      <div className="composer-actions">
        {onCancel && (
          <button type="button" onClick={onCancel}>
            취소
          </button>
        )}
        <button type="button" className="primary" onClick={send} disabled={!text.trim() || sending}>
          <CornerDownLeft size={13} /> 보내기
        </button>
      </div>
    </div>
  );
};

interface Props {
  workspace: string;
  docId: number;
  me: IUser;
  canManage: boolean;
  // 글에 붙여 막 시작한 스레드 (아직 댓글이 없음)
  draft: { threadId: string; quote: string } | null;
  active: string | null;
  onActive: (threadId: string | null) => void;
  onDraftDone: (threadId: string, posted: boolean) => void;
  onResolved: (threadId: string, resolved: boolean) => void;
  onJump?: (threadId: string) => void;
  onClose: () => void;
}

// 문서 댓글 창: 스레드별로 묶어 보여 주고, 답글·해결·고치기·지우기
const CommentsPanel: FC<Props> = ({
  workspace,
  docId,
  me,
  canManage,
  draft,
  active,
  onActive,
  onDraftDone,
  onResolved,
  onJump,
  onClose,
}) => {
  const base = `/api/workspaces/${workspace}/docs/${docId}`;
  const { data, mutate } = useSWR<DocComment[]>(`${base}/comments`, fetcher);
  const [socket] = useSocket(workspace);
  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const [editing, setEditing] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onChanged = ({ docId: changed }: { docId: number }) => {
      if (changed === docId) mutate();
    };
    socket?.on('docCommentsChanged', onChanged);
    return () => {
      socket?.off('docCommentsChanged', onChanged);
    };
  }, [socket, docId, mutate]);

  const threads = useMemo(() => {
    const map = new Map<string, Thread>();
    (data || []).forEach((c) => {
      const t = map.get(c.threadId) || { id: c.threadId, quote: null, resolved: false, comments: [] };
      if (!t.comments.length) {
        t.quote = c.quote;
        t.resolved = c.resolved;
      }
      t.comments.push(c);
      map.set(c.threadId, t);
    });
    return Array.from(map.values());
  }, [data]);
  const shown = threads.filter((t) => (tab === 'open' ? !t.resolved : t.resolved));
  const openCount = threads.filter((t) => !t.resolved).length;

  // 고른 스레드로 옮겨 가기
  useEffect(() => {
    if (!active) return;
    const thread = threads.find((t) => t.id === active);
    if (thread && thread.resolved !== (tab === 'resolved')) setTab(thread.resolved ? 'resolved' : 'open');
    listRef.current?.querySelector(`[data-thread-id="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, threads, tab]);

  const post = (threadId: string, content: string, quote?: string) =>
    axios
      .post(`${base}/comments`, { threadId, content, quote })
      .then(() => mutate())
      .catch((error) => {
        showError(error);
        throw error;
      });

  const resolve = (thread: Thread, resolved: boolean) =>
    axios
      .put(`${base}/comment-threads/${thread.id}`, { resolved })
      .then(() => {
        mutate();
        onResolved(thread.id, resolved);
      })
      .catch(showError);

  const remove = (comment: DocComment) =>
    axios
      .delete(`${base}/comments/${comment.id}`)
      .then(() => mutate())
      .catch(showError);

  const saveEdit = (comment: DocComment) =>
    axios
      .patch(`${base}/comments/${comment.id}`, { content: editText })
      .then(() => {
        setEditing(null);
        mutate();
      })
      .catch(showError);

  const draftIsNew = draft && !threads.some((t) => t.id === draft.threadId);

  return (
    <Panel aria-label="댓글">
      <header>
        <MessageSquare size={16} />
        <strong>댓글</strong>
        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'open'}
            className={tab === 'open' ? 'on' : undefined}
            onClick={() => setTab('open')}
          >
            열림 {openCount}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'resolved'}
            className={tab === 'resolved' ? 'on' : undefined}
            onClick={() => setTab('resolved')}
          >
            해결됨 {threads.length - openCount}
          </button>
        </div>
        <button type="button" className="close" onClick={onClose} aria-label="댓글 닫기">
          <X size={18} />
        </button>
      </header>
      <div className="list" ref={listRef}>
        {draftIsNew && draft && (
          <section className="thread active" data-thread-id={draft.threadId}>
            {draft.quote && <blockquote>{draft.quote}</blockquote>}
            <Composer
              autoFocus
              placeholder="고른 글에 댓글 달기"
              onSubmit={(text) => post(draft.threadId, text, draft.quote).then(() => onDraftDone(draft.threadId, true))}
              onCancel={() => onDraftDone(draft.threadId, false)}
            />
          </section>
        )}
        {tab === 'open' && !draftIsNew && (
          <section className="thread page-comment">
            <Composer placeholder="이 문서에 댓글 남기기" onSubmit={(text) => post(newThreadId(), text)} />
          </section>
        )}
        {shown.map((thread) => (
          <section
            key={thread.id}
            className={`thread${active === thread.id ? ' active' : ''}`}
            data-thread-id={thread.id}
            onClick={() => onActive(thread.id)}
          >
            {thread.quote && (
              <blockquote
                title="글로 옮겨 가기"
                onClick={(e) => {
                  e.stopPropagation();
                  onActive(thread.id);
                  onJump?.(thread.id);
                }}
              >
                {thread.quote}
              </blockquote>
            )}
            {thread.comments.map((c) => {
              const mine = c.UserId === me.id;
              return (
                <div key={c.id} className="comment">
                  {c.User ? <img src={avatarUrl(c.User, 48)} alt="" /> : <span className="avatar-blank" />}
                  <div className="body">
                    <div className="meta">
                      <b>{c.User?.nickname || '알 수 없음'}</b>
                      <span>
                        {when(c.createdAt)}
                        {c.editedAt ? ' (고침)' : ''}
                      </span>
                      {(mine || canManage) && editing !== c.id && (
                        <span className="actions">
                          {mine && (
                            <button
                              type="button"
                              aria-label="댓글 고치기"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditing(c.id);
                                setEditText(c.content);
                              }}
                            >
                              <Pencil size={12} />
                            </button>
                          )}
                          <button
                            type="button"
                            aria-label="댓글 지우기"
                            onClick={(e) => {
                              e.stopPropagation();
                              remove(c);
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </span>
                      )}
                    </div>
                    {editing === c.id ? (
                      <div className="edit">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={2}
                          aria-label="댓글 고치기"
                        />
                        <div className="composer-actions">
                          <button type="button" onClick={() => setEditing(null)}>
                            취소
                          </button>
                          <button
                            type="button"
                            className="primary"
                            onClick={() => saveEdit(c)}
                            disabled={!editText.trim()}
                          >
                            저장
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p>{c.content}</p>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="thread-actions">
              {thread.resolved ? (
                <button type="button" onClick={() => resolve(thread, false)}>
                  <RotateCcw size={13} /> 다시 열기
                </button>
              ) : (
                <button type="button" onClick={() => resolve(thread, true)}>
                  <Check size={13} /> 해결
                </button>
              )}
            </div>
            {!thread.resolved && active === thread.id && (
              <Composer placeholder="답글 달기" onSubmit={(text) => post(thread.id, text)} />
            )}
          </section>
        ))}
        {!shown.length && !draftIsNew && (
          <p className="empty">{tab === 'open' ? '열린 댓글이 없습니다.' : '해결한 댓글이 없습니다.'}</p>
        )}
      </div>
    </Panel>
  );
};

export default CommentsPanel;
