import http from 'http';
import { AddressInfo } from 'net';
import {
  buildPreview,
  decodeHtml,
  LinksService,
  parseMeta,
} from './links.service';
import { checkUrl, isPublicAddress, safeFetch } from './safe-fetch';

describe('링크 미리보기', () => {
  it('내부·예약 주소를 막는다', () => {
    [
      '127.0.0.1',
      '10.1.2.3',
      '172.20.0.5',
      '192.168.0.1',
      '169.254.169.254',
      '0.0.0.0',
      '::1',
      'fd00::1',
      'fe80::1',
      '::ffff:127.0.0.1',
    ].forEach((ip) => expect(isPublicAddress(ip)).toBe(false));
    ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'].forEach((ip) =>
      expect(isPublicAddress(ip)).toBe(true),
    );
  });

  it('http(s) 가 아니거나 계정·내부 IP 가 들어간 주소는 거절한다', () => {
    expect(() => checkUrl('file:///etc/passwd')).toThrow();
    expect(() => checkUrl('http://user:pw@example.com')).toThrow();
    expect(() => checkUrl('http://127.0.0.1:3000/')).toThrow();
    expect(() => checkUrl('http://[::1]/')).toThrow();
    expect(checkUrl('https://example.com/a').hostname).toBe('example.com');
  });

  it('localhost 처럼 이름이 내부 주소로 풀리면 연결하지 않는다', async () => {
    const server = http.createServer((_, res) => res.end('secret'));
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address() as AddressInfo;
    await expect(
      safeFetch(`http://localhost:${port}/`, { maxBytes: 1000 }),
    ).rejects.toThrow('내부 주소');
    server.close();
  });

  it('og 태그를 속성 순서·따옴표와 상관없이 읽고, 상대 그림 주소를 풀어 쓴다', () => {
    const html = `<html><head>
      <title>그냥 제목</title>
      <meta content='오픈그래프 제목 &amp; 부제' property="og:title">
      <meta property=og:description content="설명입니다">
      <meta property="og:image" content="/img/cover.png">
      <meta property="og:site_name" content="예시 사이트">
    </head></html>`;
    expect(parseMeta(html).title).toBe('그냥 제목');
    expect(buildPreview(html, 'https://example.com/post/1')).toEqual({
      url: 'https://example.com/post/1',
      siteName: '예시 사이트',
      title: '오픈그래프 제목 & 부제',
      description: '설명입니다',
      imageUrl: 'https://example.com/img/cover.png',
    });
  });

  it('og 태그가 없으면 <title> 과 도메인을 쓰고, javascript: 그림은 버린다', () => {
    const html =
      '<title> 제목만 </title><meta property="og:image" content="javascript:alert(1)">';
    expect(buildPreview(html, 'https://www.example.com/')).toMatchObject({
      title: '제목만',
      siteName: 'example.com',
      imageUrl: null,
    });
  });

  it('EUC-KR 페이지도 한글이 깨지지 않는다', () => {
    const body = Buffer.from([0xc7, 0xd1, 0xb1, 0xdb]); // '한글'
    expect(decodeHtml(body, 'text/html; charset=euc-kr')).toBe('한글');
  });

  it('그림 주소 서명은 바꾸면 통과하지 못한다', () => {
    const service = new LinksService();
    const signature = service.sign('https://example.com/a.png');
    expect(service.verify('https://example.com/a.png', signature)).toBe(true);
    expect(service.verify('https://evil.example/a.png', signature)).toBe(false);
    expect(service.verify('https://example.com/a.png', 'x')).toBe(false);
  });
});
