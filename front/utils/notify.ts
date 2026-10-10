import { parseFileContent } from '@utils/fileStore';
import { parsePollContent } from '@utils/poll';

// 브라우저 알림. 탭을 보고 있지 않을 때만 띄운다.
export const canNotify = () => typeof window !== 'undefined' && 'Notification' in window;

export const notificationPermission = (): NotificationPermission | 'unsupported' =>
  canNotify() ? Notification.permission : 'unsupported';

export const requestNotificationPermission = () =>
  canNotify() ? Notification.requestPermission() : Promise.resolve('denied' as NotificationPermission);

// 브라우저 권한과 별개로 슐랙 안에서 알림을 잠시 끌 수 있다 (이 기기에만 저장)
const PAUSE_KEY = 'shlack-notifications-paused';

export const notificationsPaused = () => {
  try {
    return localStorage.getItem(PAUSE_KEY) === '1';
  } catch {
    return false;
  }
};

export const setNotificationsPaused = (paused: boolean) => {
  try {
    if (paused) {
      localStorage.setItem(PAUSE_KEY, '1');
    } else {
      localStorage.removeItem(PAUSE_KEY);
    }
  } catch {
    // 저장소를 쓸 수 없으면 이번 화면에서만 적용되지 않는다
  }
};

export const notifyIfHidden = (title: string, body: string, onClick?: () => void) => {
  if (
    !canNotify() ||
    Notification.permission !== 'granted' ||
    document.visibilityState === 'visible' ||
    notificationsPaused()
  ) {
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
  const file = parseFileContent(content);
  if (file) {
    return `[파일] ${file.name}`;
  }
  const poll = parsePollContent(content);
  if (poll) {
    return `[투표] ${poll.q}`;
  }
  const text = content.replace(/@\[(.+?)]\((\d+?|channel|here)\)/g, '@$1');
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
};
