// GIF 메시지는 본문을 `gif:<GIPHY 주소>` 형태로 저장한다.
const GIF_PREFIX = 'gif:';
// GIPHY 미디어 서버의 GIF 만 이미지로 보여준다 (임의의 외부 이미지 로딩 방지). 서버의 GIF_URL_PATTERN 과 동일.
const GIF_URL_PATTERN = /^https:\/\/media[0-9]?\.giphy\.com\/media\/[A-Za-z0-9]+\/[A-Za-z0-9_.-]+\.gif(\?[^\s]*)?$/;

export const toGifContent = (url: string) => `${GIF_PREFIX}${url}`;

export const parseGifContent = (content: string): string | null => {
  if (!content.startsWith(GIF_PREFIX)) {
    return null;
  }
  const url = content.slice(GIF_PREFIX.length);
  return GIF_URL_PATTERN.test(url) ? url : null;
};

// 검색 결과나 알림 등 텍스트로 보여줄 때
export const describeContent = (content: string) => (parseGifContent(content) ? '[GIF]' : content);
