// 전체 이모지 목록 (한국어 이름·검색어). 처음 열 때만 따로 불러온다 (앱 첫 로딩을 무겁게 하지 않도록)
export interface EmojiItem {
  u: string; // 이모지 글자
  label: string;
  tags: string[];
}
export interface EmojiGroup {
  key: string;
  name: string;
  emojis: EmojiItem[];
}

// 같은 이모지가 표기만 달라 다른 리액션으로 나뉘지 않도록, 기본이 그림 모양인 글자 뒤의 변형 선택자(FE0F)는 뺀다
// (예: 👍️ → 👍, ❤️ 는 그대로)
export const normalizeEmoji = (emoji: string) => {
  const chars = Array.from(emoji);
  if (chars.length === 2 && chars[1] === '️' && /\p{Emoji_Presentation}/u.test(chars[0])) {
    return chars[0];
  }
  return emoji;
};

let cache: Promise<EmojiGroup[]> | null = null;

export const loadEmojis = () => {
  if (!cache) {
    cache = Promise.all([
      import(/* webpackChunkName: "emoji-data" */ 'emojibase-data/ko/compact.json'),
      import(/* webpackChunkName: "emoji-data" */ 'emojibase-data/ko/messages.json'),
    ]).then(([data, messages]) => {
      const list = (data.default || data) as unknown as {
        group?: number;
        unicode: string;
        label: string;
        tags?: string[];
      }[];
      const groupNames = (
        (messages.default || messages) as unknown as { groups: { key: string; message: string; order: number }[] }
      ).groups;
      return groupNames
        .filter((g) => g.key !== 'component')
        .sort((a, b) => a.order - b.order)
        .map((g) => ({
          key: g.key,
          name: g.message,
          emojis: list
            .filter((e) => e.group === g.order)
            .map((e) => ({ u: normalizeEmoji(e.unicode), label: e.label, tags: e.tags || [] })),
        }));
    });
  }
  return cache;
};
