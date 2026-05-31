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

onBackgroundMessage(messaging, (payload) => {
  const { title = '알림', body = '' } = payload.notification ?? {};
  return self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: payload.fcmOptions?.link ?? '/' },
  });
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
