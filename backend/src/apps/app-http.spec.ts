import http from 'http';
import { AddressInfo } from 'net';
import { isPrivateAddress, postToApp, signBody } from './app-http';

// 앱 주소로 보내는 요청: 서명, 내부망 막기
describe('앱 요청', () => {
  let server: http.Server;
  let port: number;
  let received: { headers: http.IncomingHttpHeaders; body: string } | null;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        received = { headers: req.headers, body };
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ text: '받았어요' }));
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => server.close());
  afterEach(() => {
    delete process.env.APP_ALLOW_PRIVATE_URLS;
    process.env.NODE_ENV = 'test';
  });

  it('본문과 시각으로 서명해서 보내고, 앱은 같은 방법으로 확인할 수 있다', async () => {
    const response = await postToApp(
      `http://127.0.0.1:${port}/hook`,
      { hello: '세상' },
      'secret',
    );
    expect(response).toEqual({ status: 200, body: '{"text":"받았어요"}' });
    const ts = Number(received!.headers['x-shlack-request-timestamp']);
    expect(received!.headers['x-shlack-signature']).toBe(
      signBody('secret', ts, received!.body),
    );
    expect(JSON.parse(received!.body)).toEqual({ hello: '세상' });
  });

  it('운영에서는 내부망 주소로 보내지 않는다 (따로 허락하지 않으면)', async () => {
    process.env.NODE_ENV = 'production';
    await expect(
      postToApp(`http://127.0.0.1:${port}/hook`, {}, 's'),
    ).rejects.toThrow('내부망');
    await expect(
      postToApp(`http://localhost:${port}/hook`, {}, 's'),
    ).rejects.toThrow('내부망');
    process.env.APP_ALLOW_PRIVATE_URLS = 'true';
    await expect(
      postToApp(`http://127.0.0.1:${port}/hook`, {}, 's'),
    ).resolves.toEqual(expect.objectContaining({ status: 200 }));
  });

  it('내부망 주소를 알아본다', () => {
    for (const a of [
      '10.1.2.3',
      '192.168.0.1',
      '172.20.1.1',
      '127.0.0.1',
      '169.254.169.254',
      '::1',
      'fd00::1',
      '::ffff:10.0.0.1',
    ]) {
      expect(isPrivateAddress(a)).toBe(true);
    }
    for (const a of ['8.8.8.8', '172.32.0.1', '2001:4860::8888']) {
      expect(isPrivateAddress(a)).toBe(false);
    }
  });

  it('http(s) 가 아니거나 아이디가 든 주소는 쓰지 않는다', async () => {
    await expect(postToApp('ftp://example.com/x', {}, 's')).rejects.toThrow();
    await expect(
      postToApp('http://user:pw@example.com/x', {}, 's'),
    ).rejects.toThrow();
  });
});
