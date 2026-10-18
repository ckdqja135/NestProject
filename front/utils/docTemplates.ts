import dayjs from 'dayjs';

// Docs 새로 만들기·템플릿
export const DOC_TYPE_INFO = {
  doc: { icon: '📄', label: '문서', description: '마크다운으로 쓰는 문서' },
  wiki: { icon: '📚', label: '위키 페이지', description: '워크스페이스 모두가 함께 쓰는 위키' },
  slides: { icon: '📊', label: '슬라이드', description: '--- 로 쪽을 나누는 발표 자료' },
} as const;

export interface DocTemplate {
  key: string;
  icon: string;
  name: string;
  description: string;
  type: 'doc' | 'wiki' | 'slides';
  title: () => string;
  content: () => string;
}

const today = () => dayjs().format('YYYY-MM-DD');

export const DOC_TEMPLATES: DocTemplate[] = [
  {
    key: 'meeting',
    icon: '📝',
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
    icon: '📅',
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
    icon: '🛠',
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
    icon: '📊',
    name: '발표 슬라이드',
    description: '제목 · 목차 · 본문 · 마무리',
    type: 'slides',
    title: () => '발표 자료',
    content: () =>
      [
        '# 발표 제목',
        '발표자 이름 · ' + today(),
        '',
        '---',
        '',
        '## 목차',
        '1. 배경',
        '2. 내용',
        '3. 정리',
        '',
        '---',
        '',
        '## 배경',
        '- 핵심 하나',
        '- 핵심 둘',
        '',
        '---',
        '',
        '## 정리',
        '> 한 줄 요약',
        '',
        '감사합니다 🙏',
      ].join('\n'),
  },
  {
    key: 'wiki-home',
    icon: '📚',
    name: '팀 위키 첫 페이지',
    description: '팀 소개, 규칙, 자주 묻는 질문',
    type: 'wiki',
    title: () => '팀 위키',
    content: () =>
      ['# 팀 위키', '', '## 팀 소개', '', '## 일하는 방식', '- ', '', '## 자주 묻는 질문', '**Q.** ', '**A.** '].join(
        '\n',
      ),
  },
];
