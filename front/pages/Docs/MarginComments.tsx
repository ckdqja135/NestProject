import type { Editor } from '@tiptap/react';
import { IUser } from '@typings/db';
import { avatarUrl } from '@utils/avatar';
import fetcher from '@utils/fetcher';
import axios from 'axios';
import { Check, ChevronsRight, MessageSquarePlus, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import React, { FC, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import useSWR from 'swr';
import { Composer, DocComment, groupThreads, newThreadId, showError, Thread, when } from './CommentsPanel';
import { MarginColumn } from './commentStyles';

// 문서 옆 댓글 칸 (Lark·Google 문서처럼): 댓글 카드를 댓글 단 글과 같은 높이에 붙인다.
// 카드끼리 겹치면 아래로 밀고, 고른 카드는 제 글 옆에 오도록 나머지를 위아래로 비킨다.

const GAP = 10;

interface Props {
  editor: Editor;
  workspace: string;
  docId: number;
  me: IUser;
  canManage: boolean;
  draft: { threadId: string; quote: string } | null;
  active: string | null;
  onActive: (threadId: string | null) => void;
  onDraftDone: (threadId: string, posted: boolean) => void;
  onResolved: (threadId: string, resolved: boolean) => void;
  onJump: (threadId: string) => void;
  onClose: () => void;
}

const markOf = (editor: Editor, threadId: string) =>
  /^[\w-]+$/.test(threadId)
    ? (editor.view.dom.querySelector(`.comment-mark[data-thread="${threadId}"]`) as HTMLElement | null)
    : null;

const MarginComments: FC<Props> = ({
  editor,
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
  const [showResolved, setShowResolved] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [writingPage, setWritingPage] = useState(false);
  const [tops, setTops] = useState<Record<string, number>>({});
  const [height, setHeight] = useState(0);
  const [tick, bump] = useReducer((n: number) => n + 1, 0);
  const cardsRef = useRef<HTMLDivElement>(null);
  const cardEls = useRef(new Map<string, HTMLElement>());

  const threads = useMemo(() => groupThreads(data), [data]);
  const open = threads.filter((t) => !t.resolved);
  const resolved = threads.filter((t) => t.resolved);
  const draftIsNew = !!draft && !threads.some((t) => t.id === draft.threadId);

  // 글이 바뀌거나 화면 크기가 바뀌면 다시 맞춘다
  useEffect(() => {
    const onUpdate = () => bump();
    editor.on('update', onUpdate);
    window.addEventListener('resize', onUpdate);
    const ro = new ResizeObserver(onUpdate);
    ro.observe(editor.view.dom);
    return () => {
      editor.off('update', onUpdate);
      window.removeEventListener('resize', onUpdate);
      ro.disconnect();
    };
  }, [editor]);

  // 글에 붙은 스레드 (표시가 남아 있는 것) 와 붙을 곳이 없는 스레드
  const anchoredIds = [...open.map((t) => t.id), ...(draftIsNew && draft ? [draft.threadId] : [])].filter((id) =>
    markOf(editor, id),
  );
  const loose = open.filter((t) => !anchoredIds.includes(t.id));

  // 그릴 때마다 카드 자리를 다시 재고, 달라졌을 때만 바꾼다 (그래서 의존 목록 없이 둔다)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const container = cardsRef.current;
    if (!container) return;
    const top0 = container.getBoundingClientRect().top;
    const items = anchoredIds
      .map((id) => {
        const mark = markOf(editor, id);
        return {
          id,
          anchor: mark ? mark.getBoundingClientRect().top - top0 - 6 : 0,
          h: cardEls.current.get(id)?.offsetHeight || 120,
        };
      })
      .sort((a, b) => a.anchor - b.anchor);
    const next: Record<string, number> = {};
    const ai = items.findIndex((it) => it.id === active);
    if (ai >= 0) {
      next[items[ai].id] = items[ai].anchor;
      let bottom = items[ai].anchor + items[ai].h;
      for (let i = ai + 1; i < items.length; i += 1) {
        next[items[i].id] = Math.max(items[i].anchor, bottom + GAP);
        bottom = next[items[i].id] + items[i].h;
      }
      let ceiling = items[ai].anchor;
      for (let i = ai - 1; i >= 0; i -= 1) {
        next[items[i].id] = Math.min(items[i].anchor, ceiling - GAP - items[i].h);
        ceiling = next[items[i].id];
      }
    } else {
      let bottom = -Infinity;
      items.forEach((it) => {
        next[it.id] = Math.max(it.anchor, bottom + GAP);
        bottom = next[it.id] + it.h;
      });
    }
    // 맨 위 카드가 칸 위로 나가지 않게
    const min = Math.min(0, ...Object.values(next));
    Object.keys(next).forEach((id) => {
      next[id] -= min;
    });
    const total = items.reduce((max, it) => Math.max(max, next[it.id] + it.h), 0);
    const changed =
      Object.keys(next).length !== Object.keys(tops).length ||
      Object.keys(next).some((id) => Math.abs((tops[id] ?? -9999) - next[id]) > 1);
    if (changed) setTops(next);
    if (Math.abs(total - height) > 1) setHeight(total);
  });

  // 카드 높이가 바뀌면 (답글 칸이 열리는 등) 다시 맞춘다
  const cardObserver = useRef<ResizeObserver | null>(null);
  useEffect(() => {
    const ro = new ResizeObserver(() => bump());
    cardObserver.current = ro;
    cardEls.current.forEach((el) => ro.observe(el));
    return () => {
      ro.disconnect();
      cardObserver.current = null;
    };
  }, []);
  // 카드마다 같은 ref 함수를 써서 다시 그릴 때마다 붙였다 떼지 않게 한다
  const refFns = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const cardRef = (id: string) => {
    let fn = refFns.current.get(id);
    if (!fn) {
      fn = (el: HTMLElement | null) => {
        const old = cardEls.current.get(id);
        if (old && old !== el) {
          cardObserver.current?.unobserve(old);
          cardEls.current.delete(id);
        }
        if (el && old !== el) {
          cardEls.current.set(id, el);
          cardObserver.current?.observe(el);
        }
      };
      refFns.current.set(id, fn);
    }
    return fn;
  };

  const post = (threadId: string, content: string, quote?: string) =>
    axios
      .post(`${base}/comments`, { threadId, content, quote })
      .then(() => mutate())
      .catch((error) => {
        showError(error);
        throw error;
      });

  const resolve = (thread: Thread, value: boolean) =>
    axios
      .put(`${base}/comment-threads/${thread.id}`, { resolved: value })
      .then(() => {
        mutate();
        onResolved(thread.id, value);
        if (value && active === thread.id) onActive(null);
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

  const commentRow = (c: DocComment) => {
    const mine = c.UserId === me.id;
    return (
      <div key={c.id} className="comment">
        {c.User ? <img src={avatarUrl(c.User, 64)} alt="" /> : <span className="avatar-blank" />}
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
            <div className="edit" onClick={(e) => e.stopPropagation()}>
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
                <button type="button" className="primary" onClick={() => saveEdit(c)} disabled={!editText.trim()}>
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
  };

  const card = (thread: Thread, positioned: boolean) => {
    const isActive = active === thread.id;
    return (
      <section
        key={thread.id}
        ref={cardRef(thread.id)}
        className={`card${isActive ? ' active' : ''}${positioned ? ' positioned' : ''}`}
        style={positioned ? { top: tops[thread.id] ?? 0, opacity: thread.id in tops ? undefined : 0 } : undefined}
        data-thread-id={thread.id}
        onClick={() => onActive(thread.id)}
      >
        <div className="head">
          {thread.quote ? (
            <span
              className="quote"
              title="글로 옮겨 가기"
              onClick={(e) => {
                e.stopPropagation();
                onActive(thread.id);
                onJump(thread.id);
              }}
            >
              {thread.quote}
            </span>
          ) : (
            <span className="quote page">문서 전체</span>
          )}
          {thread.resolved ? (
            <button
              type="button"
              className="head-btn"
              title="다시 열기"
              aria-label="다시 열기"
              onClick={(e) => {
                e.stopPropagation();
                resolve(thread, false);
              }}
            >
              <RotateCcw size={14} />
            </button>
          ) : (
            <button
              type="button"
              className="head-btn"
              title="해결"
              aria-label="해결"
              onClick={(e) => {
                e.stopPropagation();
                resolve(thread, true);
              }}
            >
              <Check size={15} />
            </button>
          )}
        </div>
        {thread.comments.map(commentRow)}
        {isActive && !thread.resolved && (
          <div onClick={(e) => e.stopPropagation()}>
            <Composer placeholder="댓글 추가" autoFocus={false} onSubmit={(text) => post(thread.id, text)} />
          </div>
        )}
      </section>
    );
  };

  const draftCard =
    draftIsNew && draft ? (
      <section
        key={draft.threadId}
        ref={cardRef(draft.threadId)}
        className={`card active${anchoredIds.includes(draft.threadId) ? ' positioned' : ''}`}
        style={
          anchoredIds.includes(draft.threadId)
            ? { top: tops[draft.threadId] ?? 0, opacity: draft.threadId in tops ? undefined : 0 }
            : undefined
        }
        data-thread-id={draft.threadId}
      >
        <div className="head">
          <span className="quote">{draft.quote || '문서 전체'}</span>
        </div>
        <div className="comment">
          <img src={avatarUrl(me, 64)} alt="" />
          <div className="body">
            <div className="meta">
              <b>{me.nickname}</b>
            </div>
          </div>
        </div>
        <Composer
          autoFocus
          placeholder="댓글 추가"
          onSubmit={(text) => post(draft.threadId, text, draft.quote).then(() => onDraftDone(draft.threadId, true))}
          onCancel={() => onDraftDone(draft.threadId, false)}
        />
      </section>
    ) : null;

  void tick;

  return (
    <MarginColumn aria-label="댓글" onClick={(e) => e.target === e.currentTarget && onActive(null)}>
      <header>
        <strong>댓글 ({open.length})</strong>
        <button
          type="button"
          className={`toggle${showResolved ? ' on' : ''}`}
          onClick={() => setShowResolved((v) => !v)}
          aria-pressed={showResolved}
        >
          해결됨 {resolved.length}
        </button>
        <button type="button" className="close" onClick={onClose} aria-label="댓글 닫기" title="댓글 닫기">
          <ChevronsRight size={18} />
        </button>
      </header>

      {showResolved ? (
        <div className="list">
          {resolved.length ? resolved.map((t) => card(t, false)) : <p className="empty">해결한 댓글이 없습니다.</p>}
        </div>
      ) : (
        <>
          <div className="list">
            {loose.map((t) => card(t, false))}
            {draftIsNew && draft && !anchoredIds.includes(draft.threadId) && draftCard}
            {writingPage ? (
              <section className="card active">
                <Composer
                  autoFocus
                  placeholder="이 문서에 댓글 남기기"
                  onSubmit={(text) => post(newThreadId(), text).then(() => setWritingPage(false))}
                  onCancel={() => setWritingPage(false)}
                />
              </section>
            ) : (
              <button type="button" className="add-page" onClick={() => setWritingPage(true)}>
                <MessageSquarePlus size={14} /> 문서 전체에 댓글
              </button>
            )}
          </div>
          <div className="cards" ref={cardsRef} style={{ height }}>
            {open.filter((t) => anchoredIds.includes(t.id)).map((t) => card(t, true))}
            {draftIsNew && draft && anchoredIds.includes(draft.threadId) && draftCard}
          </div>
        </>
      )}
    </MarginColumn>
  );
};

export default MarginComments;
