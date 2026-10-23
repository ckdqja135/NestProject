import axios from 'axios';

// 브라우저 푸시: 탭을 모두 닫아도 멘션·DM 알림을 받는다 (서비스 워커 /sw.js)

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

const toKey = (base64: string) => {
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(padded);
  return Uint8Array.from(Array.from(raw).map((c) => c.charCodeAt(0)));
};

// 알림 권한이 있을 때 이 브라우저를 구독한다 (이미 했으면 서버에 다시 알려 주기만)
export const enablePush = async (): Promise<boolean> => {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  const { data } = await axios.get<{ publicKey: string | null }>('/api/push/key');
  if (!data.publicKey) return false;
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toKey(data.publicKey),
    });
  }
  const json = subscription.toJSON();
  await axios.post('/api/push/subscriptions', { endpoint: json.endpoint, keys: json.keys });
  return true;
};

// 로그아웃할 때: 다음에 이 브라우저를 쓰는 사람이 내 알림을 받지 않게
export const disablePush = async () => {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await axios.delete('/api/push/subscriptions', { data: { endpoint: subscription.endpoint } }).catch(() => undefined);
  await subscription.unsubscribe().catch(() => undefined);
};
