import useCustomEmojis from '@hooks/useCustomEmojis';
import useSocket from '@hooks/useSocket';
import { IDoc, IDocFolder, IUser, IWikiPage } from '@typings/db';
import { renderDocMarkdown } from '@utils/docMarkdown';
import fetcher from '@utils/fetcher';
import axios from 'axios';
import dayjs from 'dayjs';
import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useHistory, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import useSWR, { mutate as mutateKey } from 'swr';
import { createDoc, docPath, docsBase, toastError } from './api';
import ShareDocModal from './ShareDocModal';
import {
  ArchiveRestore,
  Bold,
  Code,
  CornerLeftUp,
  Ellipsis,
  Eye,
  Folder,
  FolderInput,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  Lock,
  Minus,
  Play,
  Plus,
  Quote,
  SquareCode,
  Star,
  Strikethrough,
  Table,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import DocIcon from './DocIcon';
import SheetEditor from './sheet/SheetEditor';
import SlidePresenter from './SlidePresenter';
import { parseDeck } from './slides/model';
import SlidesEditor from './slides/SlidesEditor';
import { Banner, DocBody, DropMenu, EditorBody, EditorHeader, Empty, Outline, TitleInput, Toolbar } from './styles';

type Mode = 'edit' | 'split' | 'view';
type Status = 'saved' | 'unsaved' | 'saving' | 'error' | 'conflict';

const SAVE_DELAY = 1000;

const STATUS_TEXT: Record<Status, string> = {
  saved: '저장됨',
  unsaved: '고치는 중…',
  saving: '저장하는 중…',
  error: '저장하지 못했습니다',
  conflict: '다른 사람이 먼저 고침',
};

// 빠른 삽입 도구: [보이는 글자, 설명, 앞, 뒤, 줄 단위]
const T = { size: 16, strokeWidth: 2 };
const TOOLS: [React.ReactNode, string, string, string, boolean][] = [
  [<Heading1 key="h1" {...T} />, '큰 제목', '# ', '', true],
  [<Heading2 key="h2" {...T} />, '중간 제목', '## ', '', true],
  [<Heading3 key="h3" {...T} />, '작은 제목', '### ', '', true],
  [<Bold key="b" {...T} />, '굵게', '**', '**', false],
  [<Italic key="i" {...T} />, '기울임', '_', '_', false],
  [<Strikethrough key="s" {...T} />, '취소선', '~~', '~~', false],
  [<Code key="c" {...T} />, '코드', '`', '`', false],
  [<List key="ul" {...T} />, '글머리 목록', '- ', '', true],
  [<ListOrdered key="ol" {...T} />, '번호 목록', '1. ', '', true],
  [<ListChecks key="todo" {...T} />, '할 일 목록', '- [ ] ', '', true],
  [<Quote key="q" {...T} />, '인용', '> ', '', true],
];
const BLOCKS: [React.ReactNode, string, string][] = [
  [<SquareCode key="code" {...T} />, '코드 블록', '\n```\n코드\n```\n'],
  [<Table key="table" {...T} />, '표', '\n| 항목 | 내용 |\n| --- | --- |\n|  |  |\n'],
  [<Minus key="hr" {...T} />, '구분선', '\n---\n'],
  [<Image key="img" {...T} />, '이미지 (https 주소)', '\n![설명](https://)\n'],
];

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
  const [mode, setMode] = useState<Mode>('split');
  const [showShare, setShowShare] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [presenting, setPresenting] = useState<number | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // 서버 내용으로 맞춘다 (처음 열 때, 고친 게 없을 때 다른 사람이 저장하면)
  useEffect(() => {
    if (!doc) {
      return;
    }
    if (loadedId.current !== doc.id) {
      loadedId.current = doc.id;
      editSeq.current = 0;
      savedSeq.current = 0;
      setMode(doc.canEdit && !doc.deletedAt ? (doc.content ? 'split' : 'edit') : 'view');
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
      const body = { ...latest.current, version: versionRef.current };
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

  const insert = (before: string, after: string, lineStart: boolean) => {
    const el = textareaRef.current;
    if (!el || !canEdit) {
      return;
    }
    const { selectionStart: start, selectionEnd: end } = el;
    let from = start;
    if (lineStart) {
      from = content.lastIndexOf('\n', start - 1) + 1;
    }
    const selected = content.slice(start, end);
    const next = lineStart
      ? content.slice(0, from) + before + content.slice(from)
      : content.slice(0, start) + before + selected + after + content.slice(end);
    onEdit({ content: next });
    const cursor = lineStart ? end + before.length : start + before.length + selected.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(lineStart ? cursor : start + before.length, cursor);
    });
  };
  const insertBlock = (text: string) => {
    const el = textareaRef.current;
    if (!el || !canEdit) {
      return;
    }
    const at = el.selectionEnd;
    onEdit({ content: content.slice(0, at) + text + content.slice(at) });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(at + text.length, at + text.length);
    });
  };

  const rendered = useMemo(() => renderDocMarkdown(content, workspace, emojis), [content, workspace, emojis]);
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
  const isMarkdown = !isSlides && !isSheet;
  const isOwner = doc.OwnerId === me.id;
  const editor = (
    <div className="pane">
      <Toolbar role="toolbar" aria-label="마크다운 빠른 삽입">
        {TOOLS.map(([label, name, before, after, line]) => (
          <button key={name} type="button" title={name} aria-label={name} onClick={() => insert(before, after, line)}>
            {label}
          </button>
        ))}
        {BLOCKS.map(([label, name, text]) => (
          <button key={name} type="button" title={name} aria-label={name} onClick={() => insertBlock(text)}>
            {label}
          </button>
        ))}
      </Toolbar>
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => onEdit({ content: e.target.value })}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 's') {
            e.preventDefault();
            save();
          }
        }}
        aria-label="문서 내용 (마크다운)"
        placeholder={'# 제목\n\n마크다운으로 쓰세요. **굵게** _기울임_ `코드`, - 목록, - [ ] 할 일, | 표 |'}
        spellCheck={false}
      />
    </div>
  );
  const preview = (
    <div className="pane">
      <DocBody>
        {rendered.nodes.length ? rendered.nodes : <p style={{ color: 'var(--text-faint)' }}>내용이 없습니다.</p>}
      </DocBody>
      {children.length > 0 && (
        <DocBody>
          <h3>하위 페이지</h3>
          <ul>
            {children.map((p) => (
              <li key={p.id}>
                <Link to={docPath(workspace, p.id)}>{p.title}</Link>
              </li>
            ))}
          </ul>
        </DocBody>
      )}
    </div>
  );

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
        {isMarkdown && (
          <div className="modes" role="group" aria-label="보기 방식">
            {(canEdit ? (['edit', 'split', 'view'] as Mode[]) : (['view'] as Mode[])).map((m) => (
              <button
                key={m}
                type="button"
                className={mode === m ? 'active' : undefined}
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
              >
                {{ edit: '편집', split: '나란히', view: '보기' }[m]}
              </button>
            ))}
          </div>
        )}
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

      <TitleInput
        value={title}
        readOnly={!canEdit}
        maxLength={200}
        onChange={(e) => onEdit({ title: e.target.value })}
        aria-label="문서 제목"
        placeholder="제목"
      />
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
      {isSheet && (
        <SheetEditor value={content} title={title} readOnly={!canEdit} onChange={(next) => onEdit({ content: next })} />
      )}
      {isMarkdown && (
        <EditorBody>
          {mode !== 'view' && editor}
          {mode !== 'edit' && preview}
          {mode === 'view' && rendered.headings.length > 1 && (
            <Outline aria-label="목차">
              <strong>목차</strong>
              {rendered.headings.map((h) => (
                <a key={h.id} href={`#${h.id}`} style={{ paddingLeft: (h.level - 1) * 10 }}>
                  {h.text}
                </a>
              ))}
            </Outline>
          )}
        </EditorBody>
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
