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

// notificationclick 핸들링을 위해 onBackgroundMessage 등록하되 알림 표시는 Chrome에 위임
onBackgroundMessage(messaging, (_payload) => {
  // Chrome이 FCM notification 페이로드를 자동으로 표시함 — 중복 방지를 위해 직접 showNotification 호출 생략
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string })?.url ?? '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
