import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { safeFetch } from './safe-fetch';

export interface LinkPreview {
  url: string;
  siteName: string | null;
  title: string;
  description: string | null;
  image: string | null; // 우리 서버를 거쳐 보여 줄 그림 주소 (서명 포함)
}

const CACHE_MS = 6 * 60 * 60_000;
const FAIL_CACHE_MS = 10 * 60_000;
const MAX_CACHE = 500;
const MAX_HTML = 512 * 1024;
export const MAX_IMAGE = 5 * 1024 * 1024;

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export const decodeEntities = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n =
        code[1].toLowerCase() === 'x'
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000
        ? String.fromCodePoint(n)
        : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });

const clean = (text: string | undefined, max: number) => {
  const value = decodeEntities(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!value) {
    return null;
  }
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
};

// <meta property="og:title" content="..."> 같은 태그에서 값 읽기 (속성 순서와 따옴표 종류에 상관없이)
export function parseMeta(html: string) {
  const head = html.slice(0, MAX_HTML);
  const meta: Record<string, string> = {};
  const tags = head.match(/<meta\b[^>]*>/gi) || [];
  tags.forEach((tag) => {
    const attrs: Record<string, string> = {};
    tag.replace(
      /([a-z:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/gi,
      (_, name: string, __, d?: string, s?: string, u?: string) => {
        attrs[name.toLowerCase()] = d ?? s ?? u ?? '';
        return '';
      },
    );
    const key = (attrs.property || attrs.name || '').toLowerCase();
    if (key && attrs.content !== undefined && !(key in meta)) {
      meta[key] = attrs.content;
    }
  });
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1];
  return { meta, title };
}

// 응답 머리글이나 <meta charset> 에 적힌 문자 집합으로 읽는다 (EUC-KR 사이트 등)
export function decodeHtml(body: Buffer, contentType: string) {
  const fromHeader = /charset=([\w-]+)/i.exec(contentType)?.[1];
  const sniff = body.subarray(0, 2048).toString('latin1');
  const fromMeta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(sniff)?.[1];
  const charset = (fromHeader || fromMeta || 'utf-8').toLowerCase();
  try {
    return new TextDecoder(charset).decode(body);
  } catch {
    return body.toString('utf8');
  }
}

export function buildPreview(
  html: string,
  pageUrl: string,
): Omit<LinkPreview, 'image'> & { imageUrl: string | null } {
  const { meta, title } = parseMeta(html);
  const pick = (...keys: string[]) =>
    keys.map((k) => meta[k]).find((v) => v && v.trim());
  const rawImage = pick(
    'og:image:secure_url',
    'og:image',
    'twitter:image',
    'twitter:image:src',
  );
  let imageUrl: string | null = null;
  if (rawImage) {
    try {
      const resolved = new URL(decodeEntities(rawImage.trim()), pageUrl);
      imageUrl = /^https?:$/.test(resolved.protocol)
        ? resolved.toString()
        : null;
    } catch {
      imageUrl = null;
    }
  }
  const host = new URL(pageUrl).hostname.replace(/^www\./, '');
  return {
    url: pageUrl,
    siteName: clean(pick('og:site_name', 'application-name'), 60) || host,
    title: clean(pick('og:title', 'twitter:title') || title, 150) || '',
    description: clean(
      pick('og:description', 'twitter:description', 'description'),
      300,
    ),
    imageUrl,
  };
}

@Injectable()
export class LinksService {
  private logger = new Logger('LinksService');
  private cache = new Map<string, { at: number; value: LinkPreview | null }>();
  private pending = new Map<string, Promise<LinkPreview | null>>();

  private secret() {
    return process.env.SECRET || 'shlack-link-preview';
  }

  sign(url: string) {
    return createHmac('sha256', this.secret())
      .update(url)
      .digest('base64url')
      .slice(0, 32);
  }

  verify(url: string, signature: string) {
    const expected = Buffer.from(this.sign(url));
    const given = Buffer.from(signature || '');
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  imagePath(url: string) {
    return `/api/link-image?u=${encodeURIComponent(url)}&s=${this.sign(url)}`;
  }

  async preview(url: string): Promise<LinkPreview | null> {
    const cached = this.cache.get(url);
    if (
      cached &&
      Date.now() - cached.at < (cached.value ? CACHE_MS : FAIL_CACHE_MS)
    ) {
      return cached.value;
    }
    // 같은 주소를 여러 사람이 동시에 열어도 한 번만 가져온다
    let task = this.pending.get(url);
    if (!task) {
      task = this.load(url).finally(() => this.pending.delete(url));
      this.pending.set(url, task);
    }
    const value = await task;
    if (this.cache.size >= MAX_CACHE) {
      this.cache.delete(this.cache.keys().next().value as string);
    }
    this.cache.set(url, { at: Date.now(), value });
    return value;
  }

  private async load(url: string): Promise<LinkPreview | null> {
    try {
      const page = await safeFetch(url, {
        maxBytes: MAX_HTML,
        truncate: true,
        accept: 'text/html,application/xhtml+xml',
        allowType: (type) => /text\/html|application\/xhtml/i.test(type),
      });
      const { imageUrl, ...rest } = buildPreview(
        decodeHtml(page.body, page.contentType),
        page.url,
      );
      if (!rest.title) {
        return null;
      }
      return { ...rest, image: imageUrl ? this.imagePath(imageUrl) : null };
    } catch (error) {
      this.logger.debug(`미리보기 실패 ${url}: ${(error as Error).message}`);
      return null;
    }
  }

  async image(url: string) {
    return safeFetch(url, {
      maxBytes: MAX_IMAGE,
      accept: 'image/*',
      allowType: (type) => /^image\/(png|jpe?g|gif|webp|avif)/i.test(type),
    });
  }
}
