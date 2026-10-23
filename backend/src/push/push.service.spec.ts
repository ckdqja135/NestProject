import { isAllowedEndpoint } from './push.service';

describe('푸시 주소 확인', () => {
  it('브라우저 회사의 푸시 서버만 받는다', () => {
    expect(
      isAllowedEndpoint('https://fcm.googleapis.com/fcm/send/abc', true),
    ).toBe(true);
    expect(
      isAllowedEndpoint(
        'https://updates.push.services.mozilla.com/wpush/v2/x',
        true,
      ),
    ).toBe(true);
    expect(isAllowedEndpoint('https://web.push.apple.com/abc', true)).toBe(
      true,
    );
    expect(isAllowedEndpoint('https://evil.example.com/push', true)).toBe(
      false,
    );
    expect(isAllowedEndpoint('http://fcm.googleapis.com/x', true)).toBe(false);
    expect(isAllowedEndpoint('http://10.0.0.5/admin', false)).toBe(false);
  });

  it('개발 중에만 이 컴퓨터 주소를 허용한다 (가짜 푸시 서버 시험용)', () => {
    expect(isAllowedEndpoint('http://localhost:9999/push', false)).toBe(true);
    expect(isAllowedEndpoint('http://localhost:9999/push', true)).toBe(false);
  });
});
