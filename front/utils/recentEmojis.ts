// 이 기기에서 최근에 쓴 이모지 (이모지 고르기 맨 위에 보여준다)
export const RECENT_EMOJIS_KEY = 'shlack-recent-emojis';
const MAX = 16;

export const getRecentEmojis = (): string[] => {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_EMOJIS_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

export const addRecentEmoji = (emoji: string) => {
  try {
    const next = [emoji, ...getRecentEmojis().filter((e) => e !== emoji)].slice(0, MAX);
    localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(next));
  } catch {
    // 저장소를 쓸 수 없으면 기억하지 않는다
  }
};
