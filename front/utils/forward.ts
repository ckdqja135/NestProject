// 전달한 메시지: 내용은 fwd:{"c":"덧붙인 말","m":{원본 요약}} (서버가 원본을 확인하고 만든다)
export interface ForwardedMessage {
  c: string;
  m: {
    a: string; // 원래 보낸 사람
    ai: number | null;
    ch: string | null; // 채널 이름 (DM 이면 null)
    at: string;
    t: string; // 원래 내용
    l: string | null; // 원본 주소 (채널 메시지만)
  };
}

export const parseForwardContent = (content: string): ForwardedMessage | null => {
  if (!content.startsWith('fwd:')) return null;
  try {
    const value = JSON.parse(content.slice(4));
    if (typeof value?.c === 'string' && typeof value?.m?.t === 'string' && typeof value.m.a === 'string') {
      return value;
    }
  } catch {
    // 형식이 맞지 않으면 그냥 글로 보여준다
  }
  return null;
};
