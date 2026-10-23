import { LookupFunction, BlockList, isIP } from 'net';
import { lookup as dnsLookup } from 'dns';
import http, { IncomingMessage } from 'http';
import https from 'https';

// 링크 미리보기용으로 바깥 웹페이지·그림을 가져온다.
// 사내망·서버 자신(localhost, 10.x, 192.168.x, 클라우드 메타데이터 169.254.x 등)으로는 절대 요청하지 않는다 (SSRF 방지).

const blocked = new BlockList();
[
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
].forEach(([net, prefix]) =>
  blocked.addSubnet(net as string, prefix as number, 'ipv4'),
);
[
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
  ['2001:db8::', 32],
].forEach(([net, prefix]) =>
  blocked.addSubnet(net as string, prefix as number, 'ipv6'),
);

export function isPublicAddress(address: string) {
  const family = isIP(address);
  if (!family) {
    return false;
  }
  // IPv6 안에 넣은 IPv4 (::ffff:127.0.0.1)
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) {
    return isPublicAddress(mapped[1]);
  }
  return !blocked.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

export class UnsafeUrlError extends Error {}

// 실제로 접속하는 IP 를 검사한다 (DNS 를 바꿔치기해도 검사를 피할 수 없게)
type LookupCallback = (
  error: Error | null,
  address: string | { address: string; family: number }[],
  family?: number,
) => void;

const safeLookup = ((
  hostname: string,
  options: { all?: boolean },
  callback: LookupCallback,
) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) {
      return callback(error, '', 0);
    }
    const list = addresses.filter((a) => isPublicAddress(a.address));
    if (!list.length) {
      return callback(
        new UnsafeUrlError('내부 주소로는 연결할 수 없습니다.'),
        '',
        0,
      );
    }
    if (options.all) {
      return callback(null, list);
    }
    callback(null, list[0].address, list[0].family);
  });
}) as unknown as LookupFunction;

export interface FetchedResource {
  url: string; // 리다이렉트를 따라간 마지막 주소
  contentType: string;
  body: Buffer;
}

export interface SafeFetchOptions {
  maxBytes: number;
  timeoutMs?: number;
  maxRedirects?: number;
  accept?: string;
  // 이 종류가 아니면 내용을 받지 않고 그만둔다
  allowType?: (contentType: string) => boolean;
  // 크기를 넘으면 앞부분만 쓴다 (HTML 은 <head> 만 있으면 된다). 아니면 실패
  truncate?: boolean;
}

const USER_AGENT =
  'Mozilla/5.0 (compatible; ShlackLinkPreview/1.0; +https://github.com)';

export function checkUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError('주소가 올바르지 않습니다.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError('http(s) 주소만 열 수 있습니다.');
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError('계정이 들어간 주소는 열 수 없습니다.');
  }
  // IP 를 직접 적은 주소도 같은 규칙으로
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && !isPublicAddress(host)) {
    throw new UnsafeUrlError('내부 주소로는 연결할 수 없습니다.');
  }
  return url;
}

function requestOnce(
  url: URL,
  options: SafeFetchOptions,
): Promise<IncomingMessage> {
  const client = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.get(
      url,
      {
        lookup: safeLookup,
        timeout: options.timeoutMs ?? 5000,
        headers: {
          'user-agent': USER_AGENT,
          accept: options.accept || '*/*',
          'accept-language': 'ko,en;q=0.8',
        },
      },
      resolve,
    );
    req.on('timeout', () => req.destroy(new Error('응답이 너무 늦습니다.')));
    req.on('error', reject);
  });
}

export async function safeFetch(
  raw: string,
  options: SafeFetchOptions,
): Promise<FetchedResource> {
  let url = checkUrl(raw);
  const maxRedirects = options.maxRedirects ?? 3;
  for (let hop = 0; ; hop += 1) {
    const res = await requestOnce(url, options);
    const status = res.statusCode || 0;
    if (status >= 300 && status < 400 && res.headers.location) {
      res.resume();
      if (hop >= maxRedirects) {
        throw new Error('리다이렉트가 너무 많습니다.');
      }
      url = checkUrl(new URL(res.headers.location, url).toString());
      continue;
    }
    if (status < 200 || status >= 300) {
      res.resume();
      throw new Error(`응답 코드 ${status}`);
    }
    const contentType = String(res.headers['content-type'] || '');
    if (options.allowType && !options.allowType(contentType)) {
      res.resume();
      throw new Error(`지원하지 않는 형식 (${contentType})`);
    }
    const declared = Number(res.headers['content-length']);
    if (declared && declared > options.maxBytes) {
      res.resume();
      throw new Error('너무 큽니다.');
    }
    const chunks: Buffer[] = [];
    let size = 0;
    const body = await new Promise<Buffer>((resolve, reject) => {
      res.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > options.maxBytes) {
          res.destroy();
          if (options.truncate) {
            resolve(Buffer.concat(chunks));
          } else {
            reject(new Error('너무 큽니다.'));
          }
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    return { url: url.toString(), contentType, body };
  }
}
