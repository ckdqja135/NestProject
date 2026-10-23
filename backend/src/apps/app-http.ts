import { createHmac } from 'crypto';
import { lookup as dnsLookup } from 'dns';
import http from 'http';
import https from 'https';
import { isIP } from 'net';

// 앱 주소로 보내는 요청: 서명을 붙이고, 짧게 기다리고, 내부망 주소로는 보내지 않는다 (운영에서)

export const APP_TIMEOUT_MS = 5000;
const MAX_RESPONSE = 64 * 1024;

// 개발 중에는 localhost 앱도 쓸 수 있다. 운영에서 사내망 앱을 쓰려면 APP_ALLOW_PRIVATE_URLS=true
const allowPrivate = () =>
  process.env.NODE_ENV !== 'production' ||
  process.env.APP_ALLOW_PRIVATE_URLS === 'true';

const PRIVATE_V4 = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];
export const isPrivateAddress = (address: string) => {
  const v4 = address.startsWith('::ffff:') ? address.slice(7) : address;
  if (isIP(v4) === 4) {
    return PRIVATE_V4.some((pattern) => pattern.test(v4));
  }
  const v6 = address.toLowerCase();
  return (
    v6 === '::1' ||
    v6 === '::' ||
    v6.startsWith('fc') ||
    v6.startsWith('fd') ||
    v6.startsWith('fe80')
  );
};

// 주소 형식 확인 (저장할 때). 실제로 어디로 가는지는 보낼 때 다시 확인한다
export const assertAppUrl = (value: string) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('주소 형식이 올바르지 않습니다.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('http 또는 https 주소만 쓸 수 있습니다.');
  }
  if (url.username || url.password) {
    throw new Error('주소에 아이디·비밀번호를 넣을 수 없습니다.');
  }
  return url;
};

// 서명: v0=HMAC-SHA256(비밀값, "v0:{시각}:{본문}")
export const signBody = (secret: string, timestamp: number, body: string) =>
  `v0=${createHmac('sha256', secret)
    .update(`v0:${timestamp}:${body}`)
    .digest('hex')}`;

export interface AppResponse {
  status: number;
  body: string;
}

// DNS 로 찾은 주소가 내부망이면 연결하지 않는다 (DNS 를 바꿔 우회하는 것도 막는다)
const guardedLookup: typeof dnsLookup = ((
  hostname: string,
  options: any,
  callback: any,
) => {
  dnsLookup(hostname, options, (error, address, family) => {
    if (error) return callback(error, address, family);
    const list = Array.isArray(address) ? address : [{ address, family }];
    if (!allowPrivate() && list.some((a: any) => isPrivateAddress(a.address))) {
      return callback(
        new Error('내부망 주소로는 보낼 수 없습니다.'),
        address,
        family,
      );
    }
    callback(null, address, family);
  });
}) as typeof dnsLookup;

export function postToApp(
  target: string,
  payload: unknown,
  secret: string,
  timeoutMs = APP_TIMEOUT_MS,
): Promise<AppResponse> {
  let url: URL;
  try {
    url = assertAppUrl(target);
  } catch (error) {
    return Promise.reject(error);
  }
  // IP 를 바로 쓴 주소는 DNS 를 거치지 않으므로 여기서 막는다
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!allowPrivate() && isIP(host) && isPrivateAddress(host)) {
    return Promise.reject(new Error('내부망 주소로는 보낼 수 없습니다.'));
  }
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const transport = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const request = transport.request(
      url,
      {
        method: 'POST',
        lookup: guardedLookup,
        timeout: timeoutMs,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'content-length': Buffer.byteLength(body),
          'user-agent': 'Shlack-Apps/1.0',
          'x-shlack-request-timestamp': String(timestamp),
          'x-shlack-signature': signBody(secret, timestamp, body),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_RESPONSE) {
            request.destroy(new Error('앱 응답이 너무 깁니다.'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () =>
          resolve({
            status: response.statusCode || 0,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
        response.on('error', reject);
      },
    );
    request.on('timeout', () =>
      request.destroy(new Error('앱이 제때 응답하지 않았습니다.')),
    );
    request.on('error', reject);
    request.end(body);
  });
}
