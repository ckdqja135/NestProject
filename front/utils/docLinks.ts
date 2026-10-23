import { parseForwardContent } from './forward';
import { describeContent } from './gif';
import { plainMentions } from './mention';

// 채팅과 문서를 잇는 도우미: 메시지 속 우리 문서 주소 찾기, 메시지를 문서 글로 바꾸기

export interface DocRef {
  workspace: string;
  id: number;
}

// /workspace/<워크스페이스>/docs/d/<번호>  (d/12 를 찾을 때 d/123 은 빼기)
const DOC_PATH = /\/workspace\/([^/\s?#)]+)\/docs\/d\/(\d+)(?!\d)/g;

export const docUrl = (workspace: string, id: number) =>
  `${window.location.origin}/workspace/${encodeURIComponent(workspace)}/docs/d/${id}`;

export const docRoute = (workspace: string, id: number) => `/workspace/${workspace}/docs/d/${id}`;

// 메시지에 든 우리 문서 링크 (다른 사이트 주소는 빼고, 같은 문서는 한 번만)
export const docLinksIn = (content: string, max = 3): DocRef[] => {
  const text = content.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ');
  const out: DocRef[] = [];
  const seen = new Set<number>();
  const re = new RegExp(DOC_PATH.source, 'g');
  let m = re.exec(text);
  while (m && out.length < max) {
    const host = /(https?:\/\/[^\s/]+)$/.exec(text.slice(Math.max(0, m.index - 200), m.index))?.[1];
    const id = Number(m[2]);
    if ((!host || host === window.location.origin) && !seen.has(id)) {
      seen.add(id);
      out.push({ workspace: decodeURIComponent(m[1]), id });
    }
    m = re.exec(text);
  }
  return out;
};

export const isDocUrl = (url: string) => url.startsWith(window.location.origin) && docLinksIn(url, 1).length > 0;

// 메시지를 문서에 넣을 글로 (멘션은 @이름, 파일·GIF·투표는 설명, 전달한 메시지는 인용)
export const messageToText = (content: string) => {
  const forwarded = parseForwardContent(content);
  if (forwarded) {
    const quote = plainMentions(forwarded.m.t)
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n');
    return [plainMentions(forwarded.c), `> **${forwarded.m.a}**`, quote].filter(Boolean).join('\n');
  }
  return plainMentions(describeContent(content));
};

// 문서 제목 후보: 첫 줄에서 마크다운 기호를 뺀 것
export const titleFrom = (text: string, fallback: string) => {
  const line = text
    .split('\n')
    .map((l) =>
      l
        .replace(/^[#>*\-\s]+/, '')
        .replace(/[*_`~]/g, '')
        .trim(),
    )
    .find(Boolean);
  return (line || fallback).slice(0, 60);
};
