// 한 번에 하나의 통화만: 1:1 통화와 채널 허들이 서로 확인한다 (마이크·카메라를 함께 쓰지 않도록)
export type MediaSession = 'call' | 'huddle' | null;

let active: MediaSession = null;

export const getMediaSession = () => active;

export const setMediaSession = (session: MediaSession) => {
  active = session;
};
