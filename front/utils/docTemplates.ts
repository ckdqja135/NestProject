import { Deck, makeSlide, stringifyDeck, THEMES } from '@pages/Docs/slides/model';
import { Workbook } from '@pages/Docs/sheet/model';
import dayjs from 'dayjs';
import {
  BookOpen,
  CalendarCheck,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  LucideIcon,
  NotebookPen,
  Presentation,
  Wallet,
  Wrench,
} from 'lucide-react';

export type DocType = 'doc' | 'wiki' | 'slides' | 'sheet';

// Docs 새로 만들기·템플릿 (아이콘은 SVG, 색은 종류별)
export const DOC_TYPE_INFO: Record<DocType, { Icon: LucideIcon; color: string; label: string; description: string }> = {
  doc: { Icon: FileText, color: '#2f80ed', label: '문서', description: '마크다운으로 쓰는 문서' },
  slides: { Icon: Presentation, color: '#e8891d', label: '슬라이드', description: '글상자·도형·그림을 놓는 발표 자료' },
  sheet: { Icon: FileSpreadsheet, color: '#12a06b', label: '스프레드시트', description: '칸과 수식으로 계산하는 표' },
  wiki: { Icon: BookOpen, color: '#7c5cd6', label: '위키 페이지', description: '워크스페이스 모두가 함께 쓰는 위키' },
};

export interface DocTemplate {
  key: string;
  Icon: LucideIcon;
  name: string;
  description: string;
  type: DocType;
  title: () => string;
  content: () => string;
}

const today = () => dayjs().format('YYYY-MM-DD');

export const DOC_TEMPLATES: DocTemplate[] = [
  {
    key: 'meeting',
    Icon: NotebookPen,
    name: '회의록',
    description: '참석자, 안건, 결정 사항, 할 일',
    type: 'doc',
    title: () => `회의록 (${today()})`,
    content: () =>
      [
        `# 회의록 (${today()})`,
        '',
        '**참석자**: ',
        '',
        '## 안건',
        '1. ',
        '',
        '## 논의 내용',
        '- ',
        '',
        '## 결정 사항',
        '- ',
        '',
        '## 할 일',
        '- [ ] 담당자: 할 일 (기한)',
      ].join('\n'),
  },
  {
    key: 'weekly',
    Icon: CalendarCheck,
    name: '주간 보고',
    description: '지난주 한 일, 이번 주 할 일, 이슈',
    type: 'doc',
    title: () => `주간 보고 (${dayjs().startOf('week').add(1, 'day').format('M/D')} 주)`,
    content: () =>
      [
        '# 주간 보고',
        '',
        '## 지난주에 한 일',
        '- ',
        '',
        '## 이번 주에 할 일',
        '- [ ] ',
        '',
        '## 이슈·도움 필요',
        '- ',
      ].join('\n'),
  },
  {
    key: 'spec',
    Icon: Wrench,
    name: '기술 문서',
    description: '배경, 목표, 설계, 일정',
    type: 'doc',
    title: () => '기술 문서',
    content: () =>
      [
        '# 기술 문서',
        '',
        '## 배경',
        '',
        '## 목표 / 하지 않을 것',
        '- 목표: ',
        '- 하지 않을 것: ',
        '',
        '## 설계',
        '',
        '```',
        '// 코드나 다이어그램',
        '```',
        '',
        '## 일정',
        '| 단계 | 내용 | 기한 |',
        '|---|---|---|',
        '| 1 |  |  |',
      ].join('\n'),
  },
  {
    key: 'deck',
    Icon: Presentation,
    name: '발표 슬라이드',
    description: '제목 · 목차 · 본문 · 마무리',
    type: 'slides',
    title: () => '발표 자료',
    content: () => {
      const theme = THEMES[2];
      const deck: Deck = {
        v: 1,
        theme: theme.key,
        slides: [
          makeSlide('title', theme, '발표 제목', `발표자 이름 · ${today()}`),
          makeSlide('content', theme, '목차', '1. 배경\n2. 내용\n3. 정리'),
          makeSlide('two', theme, '배경'),
          makeSlide('title', theme, '감사합니다', '질문 있으신가요?'),
        ],
      };
      return stringifyDeck(deck);
    },
  },
  {
    key: 'wiki-home',
    Icon: BookOpen,
    name: '팀 위키 첫 페이지',
    description: '팀 소개, 규칙, 자주 묻는 질문',
    type: 'wiki',
    title: () => '팀 위키',
    content: () =>
      ['# 팀 위키', '', '## 팀 소개', '', '## 일하는 방식', '- ', '', '## 자주 묻는 질문', '**Q.** ', '**A.** '].join(
        '\n',
      ),
  },
  {
    key: 'budget',
    Icon: Wallet,
    name: '예산표',
    description: '항목별 금액과 합계 (SUM)',
    type: 'sheet',
    title: () => '예산표',
    content: () => {
      const rows = [
        ['항목', '단가', '수량', '금액', '비고'],
        ['노트북', '1500000', '2', '=B2*C2', ''],
        ['모니터', '300000', '3', '=B3*C3', ''],
        ['소프트웨어', '120000', '5', '=B4*C4', '연간 구독'],
        ['합계', '', '=SUM(C2:C4)', '=SUM(D2:D4)', ''],
      ];
      const cells: Workbook['sheets'][number]['cells'] = {};
      rows.forEach((row, r) =>
        row.forEach((v, c) => {
          if (!v) return;
          const key = `${'ABCDE'[c]}${r + 1}`;
          cells[key] = {
            v,
            b: r === 0 || r === rows.length - 1 || undefined,
            fmt: c === 1 || c === 3 ? 'currency' : undefined,
          };
          if (r === 0) cells[key].bg = '#e8f1fb';
        }),
      );
      const book: Workbook = {
        v: 1,
        sheets: [{ id: 'budget', name: '예산', rows: 100, cols: 26, cells, widths: { A: 140, E: 160 } }],
      };
      return JSON.stringify(book);
    },
  },
  {
    key: 'tracker',
    Icon: ClipboardList,
    name: '할 일 관리표',
    description: '담당자 · 기한 · 상태 · 진행률',
    type: 'sheet',
    title: () => '할 일 관리',
    content: () => {
      const rows = [
        ['할 일', '담당자', '기한', '상태', '진행률'],
        ['요구사항 정리', '', today(), '진행 중', '50%'],
        ['디자인 검토', '', '', '대기', '0%'],
        ['개발', '', '', '대기', '0%'],
        ['', '', '', '평균', '=AVERAGE(E2:E4)'],
      ];
      const cells: Workbook['sheets'][number]['cells'] = {};
      rows.forEach((row, r) =>
        row.forEach((v, c) => {
          if (!v) return;
          const key = `${'ABCDE'[c]}${r + 1}`;
          cells[key] = { v, b: r === 0 || undefined, fmt: c === 4 && r > 0 ? 'percent' : undefined };
          if (r === 0) cells[key].bg = '#e8f6f1';
        }),
      );
      const book: Workbook = {
        v: 1,
        sheets: [{ id: 'tracker', name: '할 일', rows: 100, cols: 26, cells, widths: { A: 180, C: 110 } }],
      };
      return JSON.stringify(book);
    },
  },
];
