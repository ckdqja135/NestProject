import Collaboration from '@tiptap/extension-collaboration';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import Underline from '@tiptap/extension-underline';
import { BubbleMenu, Editor, EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import useCollab from '@hooks/useCollab';
import { IUser } from '@typings/db';
import CollabProvider from '@utils/collab/CollabProvider';
import { Bold, Code, Highlighter, Italic, Link2, Strikethrough, Underline as UnderlineIcon } from 'lucide-react';
import { Global } from '@emotion/react';
import React, { FC, useEffect, useRef, useState } from 'react';
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';
import { ySyncPluginKey } from 'y-prosemirror';
import { Markdown } from 'tiptap-markdown';
import CollabCursor from './CollabCursor';
import ImageModal from './ImageModal';
import SlashCommand from './SlashCommand';
import { INSERT_IMAGE_EVENT } from './slashItems';
import { EditorWrap, slashMenuStyles } from './styles';

// 블록 편집기 (Notion 처럼): 쓰는 대로 서식이 보이고, '/' 로 블록을 넣고, 블록을 끌어 옮긴다.
// 내용은 실시간 동시 편집(Yjs)으로 함께 고치고, 검색·미리보기용으로 마크다운을 서버에 보낸다.

const SNAPSHOT_DELAY_MS = 2000;
const MAX_PASTED_IMAGE = 1024 * 1024;

interface Heading {
  level: number;
  text: string;
}

const markdownOf = (editor: Editor): string =>
  (editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown();

const headingsOf = (editor: Editor): Heading[] => {
  const list: Heading[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'heading') {
      list.push({ level: node.attrs.level, text: node.textContent });
    }
    return node.type.name !== 'heading';
  });
  return list;
};

interface InnerProps {
  provider: CollabProvider;
  synced: boolean;
  shouldSeed: boolean;
  editable: boolean;
  initialContent: string;
  footer?: React.ReactNode;
}

const Inner: FC<InnerProps> = ({ provider, synced, shouldSeed, editable, initialContent, footer }) => {
  const snapshotTimer = useRef<number | null>(null);
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [showImage, setShowImage] = useState(false);
  const [linkMode, setLinkMode] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const editableRef = useRef(editable);
  editableRef.current = editable;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }),
      Underline,
      Highlight,
      // 링크 끝에서 이어 쓴 글이 링크에 붙지 않게
      Link.extend({ inclusive: () => false }).configure({
        openOnClick: 'whenNotEditable',
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({ allowBase64: true }),
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === 'heading' ? '제목' : "글을 쓰거나 '/' 를 눌러 표·체크리스트·이미지를 넣으세요",
      }),
      Markdown.configure({ html: false, tightLists: true, linkify: true, transformPastedText: true }),
      GlobalDragHandle.configure({ dragHandleWidth: 22 }),
      SlashCommand,
      Collaboration.configure({ document: provider.doc }),
      CollabCursor.configure({ awareness: provider.awareness }),
    ],
    editable: false,
    editorProps: {
      attributes: { class: 'block-editor', 'aria-label': '문서 내용' },
      // 붙여 넣은 작은 그림은 문서에 바로 넣는다
      handlePaste: (view, event) => {
        const file = Array.from(event.clipboardData?.files || []).find((f) => f.type.startsWith('image/'));
        if (!file || !editableRef.current) return false;
        if (file.size > MAX_PASTED_IMAGE) return false;
        const reader = new FileReader();
        reader.onload = () => {
          const node = view.state.schema.nodes.image.create({ src: String(reader.result), alt: file.name });
          view.dispatch(view.state.tr.replaceSelectionWith(node));
        };
        reader.readAsDataURL(file);
        return true;
      },
    },
    onCreate: ({ editor: created }) => setHeadings(headingsOf(created)),
    onUpdate: ({ editor: updated, transaction }) => {
      setHeadings(headingsOf(updated));
      // 다른 사람이 고친 것은 그 사람이 보낸다
      if (!editableRef.current || transaction.getMeta(ySyncPluginKey)?.isChangeOrigin) return;
      if (snapshotTimer.current) window.clearTimeout(snapshotTimer.current);
      snapshotTimer.current = window.setTimeout(() => provider.sendSnapshot(markdownOf(updated)), SNAPSHOT_DELAY_MS);
    },
  });

  useEffect(() => {
    editor?.setEditable(editable && synced);
  }, [editor, editable, synced]);

  // 예전(마크다운) 문서를 처음 열면, 서버가 맡긴 한 사람만 블록으로 옮겨 넣는다
  useEffect(() => {
    if (!editor || !synced || !shouldSeed) return;
    if (provider.doc.getXmlFragment('default').length === 0 && initialContent.trim()) {
      editor.commands.setContent(initialContent);
      provider.sendSnapshot(markdownOf(editor));
    }
    provider.seeded();
  }, [editor, synced, shouldSeed, provider, initialContent]);

  useEffect(() => {
    const open = () => setShowImage(true);
    window.addEventListener(INSERT_IMAGE_EVENT, open);
    return () => window.removeEventListener(INSERT_IMAGE_EVENT, open);
  }, []);

  useEffect(
    () => () => {
      if (snapshotTimer.current) window.clearTimeout(snapshotTimer.current);
    },
    [],
  );

  const scrollToHeading = (index: number) => {
    const el = editor?.view.dom.querySelectorAll('h1, h2, h3, h4, h5, h6')[index];
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const applyLink = (e: React.FormEvent) => {
    e.preventDefault();
    const href = linkUrl.trim();
    if (!editor) return;
    if (!href) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor
        .chain()
        .focus()
        .setLink({ href: /^https?:\/\//i.test(href) ? href : `https://${href}` })
        .run();
    }
    setLinkMode(false);
  };

  const mark = (name: string, run: () => void, Icon: typeof Bold, label: string) => (
    <button
      type="button"
      className={editor?.isActive(name) ? 'on' : undefined}
      onClick={run}
      aria-label={label}
      title={label}
      aria-pressed={!!editor?.isActive(name)}
    >
      <Icon size={15} />
    </button>
  );

  return (
    <div className={`editor-layout${headings.length > 1 ? ' with-outline' : ''}`}>
      <div className="editor-main">
        {editor && (
          <BubbleMenu
            editor={editor}
            tippyOptions={{ duration: 120, onHidden: () => setLinkMode(false) }}
            shouldShow={({ editor: e, from, to }) => e.isEditable && from !== to && !e.isActive('image')}
          >
            <div className="bubble-menu" role="toolbar" aria-label="글자 서식">
              {linkMode ? (
                <form onSubmit={applyLink} className="link-form">
                  <input
                    autoFocus
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="링크 주소 (비우면 링크 빼기)"
                    aria-label="링크 주소"
                  />
                  <button type="submit">적용</button>
                </form>
              ) : (
                <>
                  {mark('bold', () => editor.chain().focus().toggleBold().run(), Bold, '굵게')}
                  {mark('italic', () => editor.chain().focus().toggleItalic().run(), Italic, '기울임')}
                  {mark('underline', () => editor.chain().focus().toggleUnderline().run(), UnderlineIcon, '밑줄')}
                  {mark('strike', () => editor.chain().focus().toggleStrike().run(), Strikethrough, '취소선')}
                  {mark('code', () => editor.chain().focus().toggleCode().run(), Code, '코드')}
                  {mark('highlight', () => editor.chain().focus().toggleHighlight().run(), Highlighter, '형광펜')}
                  {mark(
                    'link',
                    () => {
                      setLinkUrl(editor.getAttributes('link').href || '');
                      setLinkMode(true);
                    },
                    Link2,
                    '링크',
                  )}
                </>
              )}
            </div>
          </BubbleMenu>
        )}
        <EditorContent editor={editor} />
        {footer}
      </div>
      {headings.length > 1 && (
        <nav className="outline" aria-label="목차">
          <strong>목차</strong>
          {headings.map((h, i) => (
            <button
              key={`${i}-${h.text}`}
              type="button"
              style={{ paddingLeft: (h.level - 1) * 12 + 4 }}
              onClick={() => scrollToHeading(i)}
            >
              {h.text || '(제목 없음)'}
            </button>
          ))}
        </nav>
      )}
      <ImageModal
        show={showImage}
        onClose={() => setShowImage(false)}
        onInsert={(src, alt) => {
          setShowImage(false);
          editor?.chain().focus().setImage({ src, alt }).run();
        }}
      />
    </div>
  );
};

interface Props {
  workspace: string;
  docId: number;
  me: IUser;
  readOnly: boolean;
  initialContent: string;
  footer?: React.ReactNode;
}

const BlockEditor: FC<Props> = ({ workspace, docId, me, readOnly, initialContent, footer }) => {
  const { provider, synced, canEdit, shouldSeed, status } = useCollab(workspace, docId, me);
  return (
    <EditorWrap>
      <Global styles={slashMenuStyles} />
      {status !== 'synced' && (
        <div className={`editor-status ${status}`} role="status">
          {status === 'connecting' && '문서를 불러오는 중…'}
          {status === 'offline' && '연결이 끊겼습니다. 다시 연결하는 중… (고친 내용은 연결되면 합쳐집니다)'}
          {status === 'error' && '이 문서를 열 수 없습니다.'}
        </div>
      )}
      {provider && (
        <Inner
          key={provider.doc.guid}
          provider={provider}
          synced={synced}
          shouldSeed={shouldSeed}
          editable={canEdit && !readOnly}
          initialContent={initialContent}
          footer={footer}
        />
      )}
    </EditorWrap>
  );
};

export default BlockEditor;
