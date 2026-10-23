import useCustomEmojis from '@hooks/useCustomEmojis';
import useSocket from '@hooks/useSocket';
import { IDoc, IDocFolder, IUser, IWikiPage } from '@typings/db';
import fetcher from '@utils/fetcher';
import axios from 'axios';
import dayjs from 'dayjs';
import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useHistory, useLocation, useParams } from 'react-router-dom';
import type { Editor } from '@tiptap/react';
import { toast } from 'react-toastify';
import useSWR, { mutate as mutateKey } from 'swr';
import { createDoc, docPath, docsBase, toastError } from './api';
import ShareDocModal from './ShareDocModal';
import CommentsPanel, { DocComment } from './CommentsPanel';
import MarginComments from './MarginComments';
import { useHuddle, useHuddleWatch } from '@components/Huddle/HuddleProvider';
import { removeCommentMark, scrollToThread } from './editor/commentMarks';
import {
  ArchiveRestore,
  CornerLeftUp,
  Ellipsis,
  Eye,
  Folder,
  FolderInput,
  Lock,
  Headphones,
  MessageSquare,
  Play,
  Plus,
  Star,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import DocIcon from './DocIcon';
import SheetEditor from './sheet/SheetEditor';
import SlidePresenter from './SlidePresenter';
import { parseDeck } from './slides/model';
import SlidesEditor from './slides/SlidesEditor';
import loadable from '@loadable/component';
import useDarkTheme from '@hooks/useDarkTheme';
import { Banner, DropMenu, EditorHeader, Empty, TitleInput } from './styles';
import type { DesignApi } from './design/DesignEditor';

// 화이트보드는 큰 그리기 도구라 보드를 열 때만 불러온다
const BoardEditor = loadable(() => import('./board/BoardEditor'));
// 문서·위키는 Notion 처럼 블록으로 쓰고 여럿이 함께 고친다
const BlockEditor = loadable(() => import('./editor/BlockEditor'));
// 데이터베이스 (표·보드·캘린더·갤러리)
const DatabaseEditor = loadable(() => import('./database/DatabaseEditor'));
// 디자인(Figma 처럼)도 디자인을 열 때만 불러온다
const DesignEditor = loadable(() => import('./design/DesignEditor'));

// 실시간 동시 편집하는 종류: 내용은 편집기가 저장하고, 이 화면은 제목만 저장한다
const COLLAB_TYPES = ['doc', 'wiki', 'board', 'database', 'design'];

type Status = 'saved' | 'unsaved' | 'saving' | 'error' | 'conflict';

const SAVE_DELAY = 1000;

const STATUS_TEXT: Record<Status, string> = {
  saved: '저장됨',
  unsaved: '고치는 중…',
  saving: '저장하는 중…',
  error: '저장하지 못했습니다',
  conflict: '다른 사람이 먼저 고침',
};

interface Props {
  me: IUser;
}

const DocPage: FC<Props> = ({ me }) => {
  const { workspace, docId } = useParams<{ workspace: string; docId: string }>();
  const id = Number(docId);
  const history = useHistory();
  const base = docsBase(workspace);
  const {
    data: doc,
    error,
    mutate,
  } = useSWR<IDoc>(Number.isInteger(id) ? `${base}/docs/${id}` : null, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  const { data: wiki } = useSWR<IWikiPage[]>(doc?.type === 'wiki' ? `${base}/docs/wiki` : null, fetcher);
  const { data: folders } = useSWR<IDocFolder[]>(`${base}/doc-folders`, fetcher);
  const { map: emojis } = useCustomEmojis(workspace, false);
  const [socket] = useSocket(workspace);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<Status>('saved');
  const statusRef = useRef(status);
  statusRef.current = status;
  const [showShare, setShowShare] = useState(false);
  // 댓글 창: 알림에서 ?comments=1 로 들어오면 연다
  const location = useLocation();
  const [showComments, setShowComments] = useState(() => new URLSearchParams(location.search).has('comments'));
  const [commentDraft, setCommentDraft] = useState<{ threadId: string; quote: string } | null>(null);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const designRef = useRef<DesignApi | null>(null);
  // 넓은 화면에서는 댓글을 글 옆에 붙여 보인다 (좁으면 오른쪽 창)
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 1100px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1100px)');
    const onChange = () => setWide(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  const [showMenu, setShowMenu] = useState(false);
  const [presenting, setPresenting] = useState<number | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);

  // 저장 상태: 서버 버전, 마지막으로 고친 횟수, 저장한 횟수
  const versionRef = useRef(0);
  const editSeq = useRef(0);
  const savedSeq = useRef(0);
  const savingRef = useRef(false);
  const timerRef = useRef<number>();
  const latest = useRef({ title: '', content: '' });
  latest.current = { title, content };
  const loadedId = useRef<number>();
  const dirty = () => editSeq.current !== savedSeq.current;

  const canEdit = !!doc?.canEdit && !doc.deletedAt;
  const typeRef = useRef(doc?.type);
  typeRef.current = doc?.type;
  const dark = useDarkTheme();

  // 서버 내용으로 맞춘다 (처음 열 때, 고친 게 없을 때 다른 사람이 저장하면)
  useEffect(() => {
    if (!doc) {
      return;
    }
    if (loadedId.current !== doc.id) {
      loadedId.current = doc.id;
      editSeq.current = 0;
      savedSeq.current = 0;
      setSlideIndex(0);
      setStatus('saved');
    } else if (dirty()) {
      return;
    }
    versionRef.current = doc.version;
    setTitle(doc.title);
    setContent(doc.content);
  }, [doc]);

  const save = useCallback(
    (force = false) => {
      window.clearTimeout(timerRef.current);
      if (!loadedId.current || (!force && !dirty()) || savingRef.current) {
        return;
      }
      const seq = editSeq.current;
      // 문서·위키·화이트보드 내용은 실시간 동시 편집으로 저장되므로 제목만 보낸다
      const body =
        typeRef.current && COLLAB_TYPES.includes(typeRef.current)
          ? { title: latest.current.title, version: versionRef.current }
          : { ...latest.current, version: versionRef.current };
      const docIdNow = loadedId.current;
      savingRef.current = true;
      setStatus('saving');
      axios
        .patch<{ version: number }>(`${base}/docs/${docIdNow}`, body)
        .then((res) => {
          if (loadedId.current !== docIdNow) {
            return;
          }
          versionRef.current = res.data.version;
          savedSeq.current = seq;
          // 저장하는 동안 더 고쳤으면 이어서 저장
          if (dirty()) {
            setStatus('unsaved');
            timerRef.current = window.setTimeout(() => save(), SAVE_DELAY);
          } else {
            setStatus('saved');
          }
        })
        .catch((err) => {
          if (loadedId.current !== docIdNow) {
            return;
          }
          setStatus(err?.response?.status === 409 ? 'conflict' : 'error');
          if (err?.response?.status !== 409) {
            toastError(err);
          }
        })
        .finally(() => {
          savingRef.current = false;
        });
    },
    [base],
  );

  const onEdit = (next: { title?: string; content?: string }) => {
    if (next.title !== undefined) {
      setTitle(next.title);
    }
    if (next.content !== undefined) {
      setContent(next.content);
    }
    editSeq.current += 1;
    // 충돌 중에는 사용자가 고를 때까지 자동 저장하지 않는다
    setStatus((s) => (s === 'conflict' ? s : 'unsaved'));
    window.clearTimeout(timerRef.current);
    if (statusRef.current !== 'conflict') {
      timerRef.current = window.setTimeout(() => save(), SAVE_DELAY);
    }
  };

  // 다른 문서로 가거나 화면을 닫기 전에 남은 내용을 저장
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty()) {
        save();
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (dirty() && statusRef.current !== 'conflict') {
        save();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, save]);

  // 다른 사람이 저장하면: 고친 게 없으면 바로 새로 불러오고, 있으면 저장할 때 충돌로 알린다
  useEffect(() => {
    const onUpdated = (data: { id: number; version: number }) => {
      if (data.id !== loadedId.current || data.version <= versionRef.current) {
        return;
      }
      if (dirty()) {
        setStatus('conflict');
        window.clearTimeout(timerRef.current);
      } else {
        mutate();
      }
    };
    socket?.on('docUpdated', onUpdated);
    return () => {
      socket?.off('docUpdated', onUpdated);
    };
  }, [socket, mutate]);

  const reloadLatest = () => {
    editSeq.current = 0;
    savedSeq.current = 0;
    setStatus('saved');
    mutate();
  };
  const overwrite = () =>
    axios
      .get<IDoc>(`${base}/docs/${id}`)
      .then((res) => {
        versionRef.current = res.data.version;
        setStatus('unsaved');
        save(true);
      })
      .catch(toastError);

  const { data: comments } = useSWR<DocComment[]>(Number.isInteger(id) ? `${base}/docs/${id}/comments` : null, fetcher);
  // 문서 허들: 이 문서를 보며 함께 이야기한다
  const docHuddleScope = Number.isInteger(id) ? `doc-${id}` : null;
  const docHuddle = useHuddleWatch(docHuddleScope);
  const { join: joinHuddle, current: huddleCurrent } = useHuddle();
  const openThreads = useMemo(
    () => new Set((comments || []).filter((c) => !c.resolved).map((c) => c.threadId)).size,
    [comments],
  );
  const { data: backlinks } = useSWR<{ id: number; title: string; type: string }[]>(
    Number.isInteger(id) && (doc?.type === 'doc' || doc?.type === 'wiki') ? `${base}/docs/${id}/backlinks` : null,
    fetcher,
  );
  // 다른 사람이 댓글을 달면 개수도 맞춘다
  useEffect(() => {
    const onChanged = ({ docId: changed }: { docId: number }) => {
      if (changed === id) mutateKey(`${base}/docs/${id}/comments`);
    };
    socket?.on('docCommentsChanged', onChanged);
    return () => {
      socket?.off('docCommentsChanged', onChanged);
    };
  }, [socket, id, base]);
  // 다른 문서로 옮기면 댓글 창 상태를 비운다
  useEffect(() => {
    setCommentDraft(null);
    setActiveThread(null);
  }, [id]);

  const deckSlides = useMemo(() => (doc?.type === 'slides' ? parseDeck(content).slides : []), [doc?.type, content]);

  // 위키 상위 페이지 경로
  const wikiCrumbs = useMemo(() => {
    if (!doc || doc.type !== 'wiki' || !wiki) {
      return [];
    }
    const result: IWikiPage[] = [];
    let parent = wiki.find((p) => p.id === doc.ParentId);
    while (parent && result.length < 20) {
      result.unshift(parent);
      const next = parent.ParentId;
      parent = wiki.find((p) => p.id === next);
    }
    return result;
  }, [doc, wiki]);
  const children = doc?.type === 'wiki' ? (wiki || []).filter((p) => p.ParentId === doc.id) : [];

  if (error) {
    return <Empty>문서를 찾을 수 없거나 볼 권한이 없습니다.</Empty>;
  }
  if (!doc) {
    return null;
  }

  const settings = (body: Record<string, unknown>, message: string) =>
    axios
      .patch(`${base}/docs/${doc.id}/settings`, body)
      .then(() => {
        toast.success(message, { position: 'bottom-center' });
        mutate();
      })
      .catch(toastError);
  const toggleFavorite = () =>
    (doc.favorite ? axios.delete(`${base}/docs/${doc.id}/favorite`) : axios.put(`${base}/docs/${doc.id}/favorite`))
      .then(() => {
        mutate();
        mutateKey(`${base}/docs?tab=favorites`);
      })
      .catch(toastError);
  const trash = () =>
    axios
      .delete(`${base}/docs/${doc.id}`)
      .then(() => {
        toast.info('휴지통으로 옮겼습니다.', { position: 'bottom-center' });
        history.push(`/workspace/${workspace}/docs`);
      })
      .catch(toastError);
  const restore = () =>
    axios
      .post(`${base}/docs/${doc.id}/restore`)
      .then(() => mutate())
      .catch(toastError);

  const home = `/workspace/${workspace}/docs`;
  const isSlides = doc.type === 'slides';
  const isSheet = doc.type === 'sheet';
  const isBoard = doc.type === 'board';
  const isDesign = doc.type === 'design';
  const isBlocks = doc.type === 'doc' || doc.type === 'wiki';
  const marginComments = isBlocks && showComments && wide;
  const closeComments = () => {
    if (commentDraft && editorRef.current) removeCommentMark(editorRef.current, commentDraft.threadId);
    if (commentDraft) designRef.current?.removePin(commentDraft.threadId);
    setCommentDraft(null);
    setShowComments(false);
  };
  const onDraftDone = (threadId: string, posted: boolean) => {
    if (!posted && editorRef.current) removeCommentMark(editorRef.current, threadId);
    if (!posted) designRef.current?.removePin(threadId);
    setCommentDraft(null);
  };
  const onThreadResolved = (threadId: string, resolved: boolean) => {
    if (resolved && editorRef.current) removeCommentMark(editorRef.current, threadId);
  };
  const jumpToThread = (threadId: string) => {
    if (editorRef.current) scrollToThread(editorRef.current, threadId);
    designRef.current?.jumpTo(threadId);
  };
  const isOwner = doc.OwnerId === me.id;
  return (
    <>
      <EditorHeader>
        <div className="crumbs">
          <Link to={home}>Docs</Link>›
          {doc.type === 'wiki' ? (
            <>
              <Link to={`${home}/wiki`}>Wiki</Link>›
              {wikiCrumbs.map((p) => (
                <React.Fragment key={p.id}>
                  <Link to={docPath(workspace, p.id)}>{p.title}</Link>›
                </React.Fragment>
              ))}
            </>
          ) : doc.Folder && isOwner ? (
            <>
              <Link to={`${home}/folder/${doc.Folder.id}`}>
                <Folder size={13} style={{ verticalAlign: '-2px' }} /> {doc.Folder.name}
              </Link>
              ›
            </>
          ) : null}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <DocIcon type={doc.type} size={14} /> {title}
          </span>
        </div>
        <span className={`status${status === 'error' || status === 'conflict' ? ' error' : ''}`} role="status">
          {canEdit ? (
            STATUS_TEXT[status]
          ) : doc.deletedAt ? (
            '휴지통에 있음'
          ) : (
            <>
              <Eye size={13} style={{ verticalAlign: '-2px' }} /> 보기 전용
            </>
          )}
          {status === 'saved' && doc.LastEditor && (
            <>
              {' '}
              · {doc.LastEditor.nickname} {dayjs(doc.updatedAt).format('M/D HH:mm')}
            </>
          )}
        </span>
        {isSlides && (
          <button type="button" className="btn" onClick={() => setPresenting(slideIndex)} title="지금 쪽부터 발표">
            <Play size={13} style={{ verticalAlign: '-2px' }} /> 발표
          </button>
        )}
        <button
          type="button"
          className={`btn${doc.favorite ? ' on' : ''}`}
          onClick={toggleFavorite}
          aria-pressed={doc.favorite}
          title={doc.favorite ? '고정 해제' : '왼쪽 목록에 고정'}
        >
          <Star
            size={15}
            style={{ verticalAlign: '-3px' }}
            fill={doc.favorite ? '#f2c94c' : 'none'}
            color={doc.favorite ? '#d4a20f' : 'currentColor'}
          />
        </button>
        <button
          type="button"
          className={`btn${docHuddle ? ' live' : ''}`}
          onClick={() => joinHuddle(`doc-${doc.id}`, doc.title)}
          title="이 문서를 보며 음성·화상 허들"
        >
          <Headphones size={14} style={{ verticalAlign: '-3px' }} />{' '}
          {huddleCurrent === docHuddleScope ? '허들 중' : docHuddle ? `허들 ${docHuddle.members.length}명` : '허들'}
        </button>
        <button
          type="button"
          className={`btn${showComments ? ' on' : ''}`}
          onClick={() => setShowComments((v) => !v)}
          aria-pressed={showComments}
          title="댓글"
        >
          <MessageSquare size={14} style={{ verticalAlign: '-3px' }} /> {openThreads > 0 ? openThreads : '댓글'}
        </button>
        <button type="button" className="btn primary" onClick={() => setShowShare(true)}>
          {doc.visibility === 'private' && doc.type !== 'wiki' && (
            <Lock size={12} style={{ verticalAlign: '-1px', marginRight: 4 }} />
          )}
          공유
        </button>
        <span style={{ position: 'relative' }}>
          <button
            type="button"
            className="btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu((v) => !v);
            }}
            aria-label="문서 메뉴"
            aria-haspopup="menu"
          >
            <Ellipsis size={16} style={{ verticalAlign: '-3px' }} />
          </button>
          {showMenu && (
            <DropMenu role="menu" style={{ left: 'auto', right: 0 }} onMouseLeave={() => setShowMenu(false)}>
              {doc.type === 'wiki' && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => createDoc(workspace, { type: 'wiki', parentId: doc.id }, (p) => history.push(p))}
                >
                  <Plus size={15} /> 하위 페이지 추가
                </button>
              )}
              {doc.type !== 'wiki' && isOwner && (
                <>
                  {doc.FolderId && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => settings({ folderId: null }, '폴더 밖으로 옮겼습니다.')}
                    >
                      <CornerLeftUp size={15} /> 폴더 밖으로 옮기기
                    </button>
                  )}
                  {(folders || [])
                    .filter((f) => f.id !== doc.FolderId)
                    .map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        role="menuitem"
                        onClick={() => settings({ folderId: f.id }, `'${f.name}' 폴더로 옮겼습니다.`)}
                      >
                        <FolderInput size={15} /> {f.name} 로 옮기기
                      </button>
                    ))}
                </>
              )}
              {doc.type === 'wiki' && doc.canManage && doc.ParentId && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => settings({ parentId: null }, '맨 위 페이지로 옮겼습니다.')}
                >
                  <CornerLeftUp size={15} /> 맨 위 페이지로 옮기기
                </button>
              )}
              {doc.canManage && !doc.deletedAt && (
                <button type="button" role="menuitem" onClick={trash}>
                  <Trash2 size={15} /> 휴지통으로 옮기기
                </button>
              )}
            </DropMenu>
          )}
        </span>
      </EditorHeader>

      {doc.deletedAt && (
        <Banner role="alert">
          <Trash2 size={16} /> 휴지통에 있는 문서입니다.
          {isOwner && (
            <button type="button" onClick={restore}>
              <ArchiveRestore size={13} style={{ verticalAlign: '-2px' }} /> 되살리기
            </button>
          )}
        </Banner>
      )}
      {status === 'conflict' && (
        <Banner role="alert">
          <TriangleAlert size={16} color="#e8891d" /> 다른 사람이 먼저 이 문서를 고쳤습니다.
          <button type="button" onClick={reloadLatest}>
            최신 내용 불러오기 (내 수정 버림)
          </button>
          <button type="button" onClick={overwrite}>
            내 내용으로 덮어쓰기
          </button>
        </Banner>
      )}

      {!isDesign && (
        <TitleInput
          value={title}
          readOnly={!canEdit}
          maxLength={200}
          onChange={(e) => onEdit({ title: e.target.value })}
          aria-label="문서 제목"
          placeholder="제목"
        />
      )}
      {isDesign && (
        <DesignEditor
          workspace={workspace}
          docId={doc.id}
          me={me}
          readOnly={!canEdit}
          initialContent={doc.content}
          dark={dark}
          title={title}
          onTitle={canEdit ? (next) => onEdit({ title: next }) : undefined}
          activeThread={activeThread}
          draftThread={commentDraft?.threadId ?? null}
          onComment={(threadId, quote) => {
            setCommentDraft({ threadId, quote });
            setActiveThread(threadId);
            setShowComments(true);
          }}
          onOpenThread={(threadId) => {
            setActiveThread(threadId);
            setShowComments(true);
          }}
          apiRef={designRef}
        />
      )}
      {isSlides && (
        <SlidesEditor
          value={content}
          title={title}
          readOnly={!canEdit}
          workspace={workspace}
          emojis={emojis}
          current={slideIndex}
          onCurrentChange={setSlideIndex}
          onChange={(next) => onEdit({ content: next })}
        />
      )}
      {doc.type === 'database' && (
        <DatabaseEditor workspace={workspace} docId={doc.id} me={me} readOnly={!canEdit} initialContent={doc.content} />
      )}
      {isBoard && (
        <BoardEditor
          workspace={workspace}
          docId={doc.id}
          me={me}
          readOnly={!canEdit}
          initialContent={doc.content}
          dark={dark}
        />
      )}
      {isSheet && (
        <SheetEditor value={content} title={title} readOnly={!canEdit} onChange={(next) => onEdit({ content: next })} />
      )}
      {isBlocks && (
        <BlockEditor
          workspace={workspace}
          docId={doc.id}
          docType={doc.type}
          visibility={doc.visibility}
          me={me}
          readOnly={!canEdit}
          initialContent={doc.content}
          onEditor={(editor) => {
            editorRef.current = editor;
          }}
          onComment={(threadId, quote) => {
            setCommentDraft({ threadId, quote });
            setActiveThread(threadId);
            setShowComments(true);
          }}
          onOpenThread={(threadId) => {
            setActiveThread(threadId);
            setShowComments(true);
          }}
          renderAside={
            marginComments
              ? (editor) => (
                  <MarginComments
                    editor={editor}
                    workspace={workspace}
                    docId={doc.id}
                    me={me}
                    canManage={!!doc.canManage}
                    draft={commentDraft}
                    active={activeThread}
                    onActive={setActiveThread}
                    onDraftDone={onDraftDone}
                    onResolved={onThreadResolved}
                    onJump={jumpToThread}
                    onClose={closeComments}
                  />
                )
              : undefined
          }
          footer={
            (children.length > 0 || !!backlinks?.length) && (
              <div className="subpages">
                {children.length > 0 && (
                  <>
                    <h3>하위 페이지</h3>
                    <ul>
                      {children.map((p) => (
                        <li key={p.id}>
                          <Link to={docPath(workspace, p.id)}>{p.title}</Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {!!backlinks?.length && (
                  <>
                    <h3>이 페이지를 링크한 문서</h3>
                    <ul className="backlinks">
                      {backlinks.map((p) => (
                        <li key={p.id}>
                          <DocIcon type={p.type as 'doc'} size={14} />{' '}
                          <Link to={docPath(workspace, p.id)}>{p.title}</Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )
          }
        />
      )}
      {showComments && !marginComments && (
        <CommentsPanel
          workspace={workspace}
          docId={doc.id}
          me={me}
          canManage={!!doc.canManage}
          draft={commentDraft}
          active={activeThread}
          onActive={setActiveThread}
          onDraftDone={onDraftDone}
          onResolved={onThreadResolved}
          onJump={jumpToThread}
          onClose={closeComments}
        />
      )}
      {activeThread && /^[\w-]+$/.test(activeThread) && (
        <style>{`.comment-mark[data-thread="${activeThread}"] { background: rgba(255, 170, 0, 0.55); }`}</style>
      )}
      <ShareDocModal
        show={showShare}
        workspace={workspace}
        doc={doc}
        me={me}
        onCloseModal={() => setShowShare(false)}
        onChanged={() => mutate()}
      />
      {presenting !== null && deckSlides.length > 0 && (
        <SlidePresenter
          slides={deckSlides}
          start={Math.min(presenting, deckSlides.length - 1)}
          workspace={workspace}
          emojis={emojis}
          onClose={() => setPresenting(null)}
        />
      )}
    </>
  );
};

export default DocPage;
