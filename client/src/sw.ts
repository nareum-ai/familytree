/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

const app = initializeApp({
  apiKey: 'AIzaSyCMwRlXqDZxatmpe4fZKLyfYBi_hv4Udtw',
  authDomain: 'familytree-3221b.firebaseapp.com',
  projectId: 'familytree-3221b',
  storageBucket: 'familytree-3221b.firebasestorage.app',
  messagingSenderId: '237404804989',
  appId: '1:237404804989:web:2493070fb784a7f1b79e14',
});

const messaging = getMessaging(app);

// data-only 메시지 — Chrome 자동 표시 없이 서비스 워커가 직접 showNotification
onBackgroundMessage(messaging, (payload) => {
  const d     = (payload.data ?? {}) as Record<string, string>;
  const title = d['title'] || '우리 가족 가계도';
  const body  = d['body']  || '';
  const link  = d['link']  || 'https://familytree-3221b.web.app/';

  return self.registration.showNotification(title, {
    body,
    icon: 'https://familytree-3221b.web.app/icons/icon-192.png',
    data: { url: link },
    ...(d['tag'] ? { tag: d['tag'] } : {}),
  });
});

// 알림 클릭 → 열린 창이 있으면 그 창을 알림 링크로 이동, 없으면 새 창
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw = (event.notification.data as { url?: string })?.url ?? '/';
  const target = new URL(raw, self.location.origin);
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = clients.find(c => new URL(c.url).origin === target.origin) ?? clients[0];
    if (client) {
      const focused = await client.focus().catch(() => client);
      const cur = new URL(focused.url);
      const needsNav = target.origin === cur.origin
        && (target.pathname !== cur.pathname || target.search !== cur.search)
        && target.pathname !== '/';
      if (needsNav && 'navigate' in focused) {
        await (focused as WindowClient).navigate(target.href).catch(() => {});
      }
      return;
    }
    await self.clients.openWindow(target.href);
  })());
});
