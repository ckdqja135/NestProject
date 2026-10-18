import { renderInlineMarkdown } from '@utils/markdown';
import React, { ReactNode } from 'react';

// 문서용 마크다운: 제목, 목록(체크 목록), 표, 인용, 코드 블록, 구분선, 그림(https 주소만)
// HTML 문자열을 만들지 않고 React 요소로만 그리므로 스크립트가 끼어들 수 없다

const SAFE_IMAGE = /^https:\/\/[^\s)]+$/i;

export interface Heading {
  level: number;
  text: string;
  id: string;
}

const headingId = (text: string, index: number) => `h-${index}-${text.replace(/\s+/g, '-').slice(0, 40)}`;

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());

export function renderDocMarkdown(content: string, workspace: string, emojis: Record<string, string> = {}) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const nodes: ReactNode[] = [];
  const headings: Heading[] = [];
  const inline = (text: string, key: string) => renderInlineMarkdown(text, workspace, key, emojis);
  let i = 0;
  let key = 0;
  const next = () => `b${key++}`;

  while (i < lines.length) {
    const line = lines[i];
    // 코드 블록
    const fence = /^```([^`]*)$/.exec(line);
    if (fence) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1;
      nodes.push(
        <pre key={next()} className="doc-pre" data-lang={fence[1].trim() || undefined}>
          <code>{body.join('\n')}</code>
        </pre>,
      );
      continue;
    }
    // 제목
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const id = headingId(heading[2], headings.length);
      headings.push({ level, text: heading[2], id });
      const Tag = `h${level}` as keyof JSX.IntrinsicElements;
      nodes.push(
        <Tag key={next()} id={id}>
          {inline(heading[2], `h${key}`)}
        </Tag>,
      );
      i += 1;
      continue;
    }
    // 구분선
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      nodes.push(<hr key={next()} />);
      i += 1;
      continue;
    }
    // 그림 (한 줄 전체)
    const image = /^!\[([^\]]*)]\(([^)\s]+)\)\s*$/.exec(line);
    if (image && SAFE_IMAGE.test(image[2])) {
      nodes.push(
        <figure key={next()} className="doc-figure">
          <img src={image[2]} alt={image[1]} loading="lazy" />
          {image[1] && <figcaption>{image[1]}</figcaption>}
        </figure>,
      );
      i += 1;
      continue;
    }
    // 표: | a | b | 다음 줄 |---|---|
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1] || '')) {
      const header = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      const tableKey = next();
      nodes.push(
        <div key={tableKey} className="doc-table-wrap">
          <table className="doc-table">
            <thead>
              <tr>
                {header.map((cell, c) => (
                  <th key={c}>{inline(cell, `${tableKey}h${c}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {header.map((_, c) => (
                    <td key={c}>{inline(row[c] || '', `${tableKey}r${r}c${c}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    // 인용
    if (/^>\s?/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        body.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      nodes.push(
        <blockquote key={next()} className="doc-quote">
          {renderDocMarkdown(body.join('\n'), workspace, emojis).nodes}
        </blockquote>,
      );
      continue;
    }
    // 목록 (- * + 또는 1.), 체크 목록 - [ ] / - [x]
    const listItem = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(line);
    if (listItem) {
      const ordered = /\d+\./.test(listItem[2]);
      const items: { text: string; checked: boolean | null; depth: number }[] = [];
      while (i < lines.length) {
        const m = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(lines[i]);
        if (!m || /\d+\./.test(m[2]) !== ordered) {
          break;
        }
        const task = /^\[( |x|X)]\s+(.*)$/.exec(m[3]);
        items.push({
          text: task ? task[2] : m[3],
          checked: task ? task[1].toLowerCase() === 'x' : null,
          depth: Math.min(Math.floor(m[1].replace(/\t/g, '  ').length / 2), 4),
        });
        i += 1;
      }
      const ListTag = ordered ? 'ol' : 'ul';
      const listKey = next();
      nodes.push(
        <ListTag key={listKey} className={items.some((it) => it.checked !== null) ? 'doc-tasks' : undefined}>
          {items.map((item, n) => (
            <li key={n} style={item.depth ? { marginLeft: item.depth * 20 } : undefined}>
              {item.checked !== null && <input type="checkbox" checked={item.checked} readOnly aria-label="할 일" />}
              {inline(item.text, `${listKey}i${n}`)}
            </li>
          ))}
        </ListTag>,
      );
      continue;
    }
    // 빈 줄
    if (!line.trim()) {
      i += 1;
      continue;
    }
    // 문단 (빈 줄이나 다른 블록이 나올 때까지)
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(```|#{1,6}\s|>\s?|(\s*)([-*+]|\d+\.)\s+|(-{3,}|\*{3,}|_{3,})\s*$)/.test(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    // 어떤 블록에도 맞지 않는 줄(예: ```c++)은 글자 그대로 한 줄을 문단으로 (무한 반복 방지)
    if (!para.length) {
      para.push(lines[i]);
      i += 1;
    }
    const paraKey = next();
    nodes.push(
      <p key={paraKey}>
        {para.map((text, n) => (
          <React.Fragment key={n}>
            {n > 0 && <br />}
            {inline(text, `${paraKey}l${n}`)}
          </React.Fragment>
        ))}
      </p>,
    );
  }
  return { nodes, headings };
}

// 슬라이드: 한 줄짜리 --- 로 쪽을 나눈다
export const splitSlides = (content: string) =>
  content
    .replace(/\r\n/g, '\n')
    .split(/\n-{3,}\s*\n/)
    .map((slide) => slide.trim());
