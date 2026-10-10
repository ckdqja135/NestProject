import React, { ReactNode } from 'react';
import { Link } from 'react-router-dom';

// 채팅용 간단한 마크다운. HTML 문자열을 만들지 않고 React 요소로만 그리므로 스크립트가 끼어들 수 없다.
// 지원: ```코드 블록```, `코드`, **굵게**, *기울임* / _기울임_, ~~취소선~~, > 인용, [글](https://…), URL 자동 링크, @멘션

const SAFE_URL = /^https?:\/\//i;

// 슐랙 안의 주소(메시지 링크 등)면 새 창 대신 앱 안에서 이동할 경로를 돌려준다
const internalPath = (url: string) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  if (origin && url.startsWith(`${origin}/workspace/`)) {
    return url.slice(origin.length);
  }
  return null;
};

const renderLink = (key: string, url: string, children: ReactNode) => {
  const path = internalPath(url);
  return path ? (
    <Link key={key} to={path}>
      {children}
    </Link>
  ) : (
    <a key={key} href={url} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
};

// 왼쪽부터 가장 먼저 나오는 인라인 문법을 찾는다
const INLINE = new RegExp(
  [
    /@\[(.+?)]\((\d+?|channel|here)\)/.source, // 1,2: 멘션 (@channel, @here 포함)
    /`([^`\n]+)`/.source, // 3: 코드
    /\[([^\]\n]+)]\((https?:\/\/[^\s)]+)\)/.source, // 4,5: 링크
    /\*\*([^\n]+?)\*\*/.source, // 6: 굵게
    /~~([^~\n]+?)~~/.source, // 7: 취소선
    /(^|[^\w*])\*([^*\n]+?)\*(?=$|[^\w*])/.source, // 8,9: *기울임*
    /(^|[^\w_])_([^_\n]+?)_(?=$|[^\w_])/.source, // 10,11: _기울임_
    /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])/.source, // 12: URL
  ].join('|'),
);

function renderInline(text: string, workspace: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let rest = text;
  let i = 0;
  while (rest) {
    const m = INLINE.exec(rest);
    if (!m) {
      nodes.push(rest);
      break;
    }
    // 기울임 패턴은 앞 글자 1개를 함께 잡으므로 그만큼 앞에 그대로 둔다
    const lead = m[8] ?? m[10] ?? '';
    if (m.index + lead.length > 0) {
      nodes.push(rest.slice(0, m.index) + lead);
    }
    const key = `${keyPrefix}-${i++}`;
    if (m[1] !== undefined && (m[2] === 'channel' || m[2] === 'here')) {
      // 서버와 같은 규칙: 표시 이름과 대상이 같을 때만 채널 전체 멘션 (@[here](channel) 같은 위장은 글자로)
      if (m[1] !== m[2]) {
        nodes.push(<span key={key}>@{m[1]}</span>);
        rest = rest.slice(m.index + m[0].length);
        continue;
      }
      nodes.push(
        <span key={key} className="md-mention-all" title={m[2] === 'channel' ? '채널 전체' : '접속 중인 사람'}>
          @{m[2]}
        </span>,
      );
    } else if (m[1] !== undefined) {
      nodes.push(
        <Link key={key} to={`/workspace/${workspace}/dm/${m[2]}`}>
          @{m[1]}
        </Link>,
      );
    } else if (m[3] !== undefined) {
      nodes.push(
        <code key={key} className="md-code">
          {m[3]}
        </code>,
      );
    } else if (m[4] !== undefined && SAFE_URL.test(m[5])) {
      nodes.push(renderLink(key, m[5], renderInline(m[4], workspace, key)));
    } else if (m[6] !== undefined) {
      nodes.push(<strong key={key}>{renderInline(m[6], workspace, key)}</strong>);
    } else if (m[7] !== undefined) {
      nodes.push(<del key={key}>{renderInline(m[7], workspace, key)}</del>);
    } else if (m[9] !== undefined || m[11] !== undefined) {
      nodes.push(<em key={key}>{renderInline((m[9] ?? m[11]) as string, workspace, key)}</em>);
    } else if (m[12] !== undefined) {
      nodes.push(renderLink(key, m[12], /[?&]message=/.test(m[12]) && internalPath(m[12]) ? '🔗 메시지 링크' : m[12]));
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return nodes;
}

// 줄 단위: '> ' 로 시작하는 연속된 줄은 인용으로 묶는다
function renderLines(text: string, workspace: string, keyPrefix: string): ReactNode[] {
  const lines = text.split('\n');
  const nodes: ReactNode[] = [];
  let quote: string[] = [];
  const flushQuote = (index: number) => {
    if (quote.length) {
      nodes.push(
        <blockquote key={`${keyPrefix}-q${index}`} className="md-quote">
          {renderLines(quote.join('\n'), workspace, `${keyPrefix}-q${index}`)}
        </blockquote>,
      );
      quote = [];
    }
  };
  let prevWasLine = false;
  lines.forEach((line, index) => {
    if (/^>\s?/.test(line)) {
      quote.push(line.replace(/^>\s?/, ''));
      return;
    }
    if (quote.length) {
      flushQuote(index);
      prevWasLine = false;
    }
    if (prevWasLine) {
      nodes.push(<br key={`${keyPrefix}-br${index}`} />);
    }
    nodes.push(...renderInline(line, workspace, `${keyPrefix}-l${index}`));
    prevWasLine = true;
  });
  flushQuote(lines.length);
  return nodes;
}

export function renderMarkdown(content: string, workspace: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const fence = /```(?:[\w-]*\n)?([\s\S]*?)```/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = fence.exec(content))) {
    if (match.index > last) {
      nodes.push(...renderLines(content.slice(last, match.index).replace(/\n$/, ''), workspace, `t${i}`));
    }
    nodes.push(
      <pre key={`c${i}`} className="md-pre">
        <code>{match[1].replace(/\n$/, '')}</code>
      </pre>,
    );
    last = match.index + match[0].length;
    i += 1;
  }
  if (last < content.length) {
    nodes.push(...renderLines(content.slice(last).replace(/^\n/, ''), workspace, `t${i}`));
  }
  return nodes;
}
