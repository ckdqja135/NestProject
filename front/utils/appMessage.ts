// 앱 메시지의 버튼: 본문이 `appmsg:{"t":글,"b":[버튼…]}` (서버 apps/app-message.ts 와 같은 형식)

export interface AppButton {
  id: string;
  label: string;
  style?: 'primary' | 'danger';
  value?: string;
}

export const parseAppMessage = (content: string): { text: string; buttons: AppButton[] } | null => {
  if (!content.startsWith('appmsg:')) return null;
  try {
    const value = JSON.parse(content.slice('appmsg:'.length));
    if (typeof value?.t !== 'string' || !Array.isArray(value.b)) return null;
    return { text: value.t, buttons: value.b };
  } catch {
    return null;
  }
};
