import { Editor, Range } from '@tiptap/core';
import {
  CheckSquare,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Image,
  List,
  ListOrdered,
  LucideIcon,
  Minus,
  Quote,
  Table,
  Type,
} from 'lucide-react';

export interface SlashItem {
  key: string;
  title: string;
  description: string;
  Icon: LucideIcon;
  keywords: string[];
  run: (editor: Editor, range: Range) => void;
}

// 이미지 넣기는 창을 띄워야 해서 편집기 화면에 알린다
export const INSERT_IMAGE_EVENT = 'shlack:insert-image';

const chain = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range);

// '/' 를 누르면 나오는 블록 목록
export const SLASH_ITEMS: SlashItem[] = [
  {
    key: 'text',
    title: '글',
    description: '보통 문단',
    Icon: Type,
    keywords: ['글', '문단', 'text', 'paragraph', 'p'],
    run: (e, r) => chain(e, r).setParagraph().run(),
  },
  {
    key: 'h1',
    title: '제목 1',
    description: '큰 제목',
    Icon: Heading1,
    keywords: ['제목', '제목1', 'h1', 'heading', '큰'],
    run: (e, r) => chain(e, r).setNode('heading', { level: 1 }).run(),
  },
  {
    key: 'h2',
    title: '제목 2',
    description: '중간 제목',
    Icon: Heading2,
    keywords: ['제목', '제목2', 'h2', 'heading', '중간'],
    run: (e, r) => chain(e, r).setNode('heading', { level: 2 }).run(),
  },
  {
    key: 'h3',
    title: '제목 3',
    description: '작은 제목',
    Icon: Heading3,
    keywords: ['제목', '제목3', 'h3', 'heading', '작은'],
    run: (e, r) => chain(e, r).setNode('heading', { level: 3 }).run(),
  },
  {
    key: 'bullet',
    title: '글머리 목록',
    description: '• 로 시작하는 목록',
    Icon: List,
    keywords: ['목록', '글머리', 'bullet', 'list', 'ul'],
    run: (e, r) => chain(e, r).toggleBulletList().run(),
  },
  {
    key: 'ordered',
    title: '번호 목록',
    description: '1. 2. 3. 으로 매기는 목록',
    Icon: ListOrdered,
    keywords: ['목록', '번호', 'number', 'ordered', 'ol'],
    run: (e, r) => chain(e, r).toggleOrderedList().run(),
  },
  {
    key: 'todo',
    title: '할 일 목록',
    description: '체크할 수 있는 목록',
    Icon: CheckSquare,
    keywords: ['할일', '할 일', '체크', 'todo', 'task', 'check'],
    run: (e, r) => chain(e, r).toggleTaskList().run(),
  },
  {
    key: 'quote',
    title: '인용',
    description: '다른 사람의 말이나 강조',
    Icon: Quote,
    keywords: ['인용', 'quote', 'blockquote'],
    run: (e, r) => chain(e, r).toggleBlockquote().run(),
  },
  {
    key: 'code',
    title: '코드 블록',
    description: '고정폭 글꼴로 쓰는 코드',
    Icon: Code2,
    keywords: ['코드', 'code'],
    run: (e, r) => chain(e, r).toggleCodeBlock().run(),
  },
  {
    key: 'divider',
    title: '구분선',
    description: '가로줄로 나누기',
    Icon: Minus,
    keywords: ['구분선', '줄', 'divider', 'hr', 'line'],
    run: (e, r) => chain(e, r).setHorizontalRule().run(),
  },
  {
    key: 'table',
    title: '표',
    description: '3×3 표 (머리줄 포함)',
    Icon: Table,
    keywords: ['표', 'table'],
    run: (e, r) => chain(e, r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    key: 'image',
    title: '이미지',
    description: '주소나 파일로 그림 넣기',
    Icon: Image,
    keywords: ['이미지', '그림', '사진', 'image', 'img', 'picture'],
    run: (e, r) => {
      chain(e, r).run();
      window.dispatchEvent(new CustomEvent(INSERT_IMAGE_EVENT));
    },
  },
];

export const filterSlashItems = (query: string) => {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_ITEMS;
  return SLASH_ITEMS.filter(
    (item) => item.title.toLowerCase().includes(q) || item.keywords.some((k) => k.toLowerCase().includes(q)),
  );
};
