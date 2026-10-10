// 브라우저 알림. 탭을 보고 있지 않을 때만 띄운다.
export const canNotify = () => typeof window !== 'undefined' && 'Notification' in window;

export const notificationPermission = (): NotificationPermission | 'unsupported' =>
  canNotify() ? Notification.permission : 'unsupported';

export const requestNotificationPermission = () =>
  canNotify() ? Notification.requestPermission() : Promise.resolve('denied' as NotificationPermission);

export const notifyIfHidden = (title: string, body: string, onClick?: () => void) => {
  if (!canNotify() || Notification.permission !== 'granted' || document.visibilityState === 'visible') {
    return;
  }
  const notification = new Notification(title, { body, tag: `${title}-${body}`.slice(0, 64) });
  notification.onclick = () => {
    window.focus();
    onClick?.();
    notification.close();
  };
};

// 멘션 마크업(@[닉네임](id))과 GIF/이미지를 알림용 텍스트로
export const previewText = (content: string) => {
  if (content.startsWith('gif:')) {
    return '[GIF]';
  }
  if (content.startsWith('uploads/') || content.startsWith('uploads\\')) {
    return '[이미지]';
  }
  const text = content.replace(/@\[(.+?)]\((\d+?)\)/g, '@$1');
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
};
