// 앱 메시지의 버튼: 본문을 `appmsg:{"t":글,"b":[버튼…]}` 로 저장한다 (버튼이 없으면 그냥 글)

export interface AppButton {
  id: string;
  label: string;
  style?: 'primary' | 'danger';
  value?: string;
}

export const APP_MESSAGE_PREFIX = 'appmsg:';
export const MAX_BUTTONS = 5;

export const toAppMessage = (text: string, buttons?: AppButton[]) =>
  buttons?.length
    ? `${APP_MESSAGE_PREFIX}${JSON.stringify({
        t: text,
        b: buttons.slice(0, MAX_BUTTONS).map((b) => ({
          id: b.id,
          label: b.label,
          ...(b.style ? { style: b.style } : {}),
          ...(b.value ? { value: b.value } : {}),
        })),
      })}`
    : text;

export const parseAppMessage = (
  content: string | null | undefined,
): { text: string; buttons: AppButton[] } | null => {
  if (!content?.startsWith(APP_MESSAGE_PREFIX)) return null;
  try {
    const value = JSON.parse(content.slice(APP_MESSAGE_PREFIX.length));
    if (typeof value?.t !== 'string' || !Array.isArray(value.b)) return null;
    return { text: value.t, buttons: value.b };
  } catch {
    return null;
  }
};
