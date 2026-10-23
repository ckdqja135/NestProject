/* 슐랙 서비스 워커: 탭을 모두 닫아도 서버가 보낸 푸시(멘션·DM)를 알림으로 띄운다 */
/* eslint-disable no-restricted-globals */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: '슐랙', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || '슐랙', {
      body: data.body || '',
      tag: data.tag,
      data: { url: data.url || '/' },
    }),
  );
});

// 알림을 누르면 열려 있는 슐랙 창으로 가서 그 메시지를 연다 (없으면 새 창)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((w) => w.url.startsWith(self.location.origin));
      if (open) {
        await open.focus();
        open.postMessage({ type: 'shlack-open', url });
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
