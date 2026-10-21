import { useEffect } from 'react';
import { getToken } from 'firebase/messaging';
import { getMessagingInstance } from '../lib/firebase';
import { LS } from '../lib/storageKeys';
import { getMemberId, isAdminReturn } from '../lib/session';
import { VAPID_KEY, ensureNotificationPermission, fcmTokenField } from '../lib/pushNotifications';
import { saveFcmToken } from '../services/authService';

const REQUEST_DELAY_MS = 5000; // 로그인 직후 바로 권한을 물으면 거부율이 높음

/** PWA에서만 알림 권한 요청 + 토큰 저장 (앱 시작 시 1회) */
export function useFCMToken() {
  useEffect(() => {
    const memberId = getMemberId();
    if (!memberId || isAdminReturn()) return;

    const setup = async () => {
      const messaging = await getMessagingInstance();
      if (!messaging) return;
      try {
        if (Notification.permission === 'denied') return;
        if (!(await ensureNotificationPermission())) return;
        const swReg = await navigator.serviceWorker.ready;

        // 기존 push 구독 해제 후 재등록 (TWA permission-blocked 우회)
        const prevToken = localStorage.getItem(LS.FCM_TOKEN_SAVED);
        if (!prevToken) {
          const existingSub = await swReg.pushManager.getSubscription();
          if (existingSub) await existingSub.unsubscribe();
        }

        const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
        if (!token || prevToken === token) return;
        await saveFcmToken(memberId, token, fcmTokenField());
        localStorage.setItem(LS.FCM_TOKEN_SAVED, token);
      } catch {
        // 지원 안되는 환경이거나 거부 — 조용히 무시
      }
    };

    const timer = setTimeout(setup, REQUEST_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
}
