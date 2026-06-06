import { useEffect } from 'react';
import { getToken } from 'firebase/messaging';
import { getMessagingInstance } from '../lib/firebase';
import { useFamilyStore } from '../store/familyStore';
import { LS } from '../lib/storageKeys';

const VAPID_KEY = 'BLRyRDSVY-2HCMviKpkqFKB2Nf2WHLipd2dh6WdQSK7thzEVX1UNENkr9oviMKeqFhgmELvbpD0yIrJm2xgLz-g';


export function useFCMToken() {
  const { saveFcmToken } = useFamilyStore();

  // PWA에서만 알림 권한 요청 + 토큰 저장
  useEffect(() => {
    const memberId      = localStorage.getItem(LS.MEMBER_ID);
    const isAdminReturn = localStorage.getItem(LS.ADMIN_RETURN) === 'true';
    if (!memberId || isAdminReturn) return;

    const setup = async () => {
      const messaging = await getMessagingInstance();
      if (!messaging) return;
      try {
        if (Notification.permission === 'denied') return;
        if (Notification.permission !== 'granted') {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') return;
        }
        const swReg = await navigator.serviceWorker.ready;

        // 기존 push 구독 해제 후 재등록 (TWA permission-blocked 우회)
        const prevToken = localStorage.getItem(LS.FCM_TOKEN_SAVED);
        if (!prevToken) {
          const existingSub = await swReg.pushManager.getSubscription();
          if (existingSub) await existingSub.unsubscribe();
        }

        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: swReg,
        });
        if (!token) return;
        if (prevToken === token) return;
        const field = sessionStorage.getItem('_admin_pwa') === '1'
          ? 'fcm_token_admin' : 'fcm_token';
        await saveFcmToken(memberId, token, field);
        localStorage.setItem(LS.FCM_TOKEN_SAVED, token);
      } catch {
        // 지원 안되는 환경이거나 거부 — 조용히 무시
      }
    };

    // 로그인 후 5초 뒤 요청 (즉시 뜨면 거부율 높음)
    const timer = setTimeout(setup, 5000);
    return () => clearTimeout(timer);
  }, []);

  // 포그라운드 알림 — 서비스워커가 처리하므로 별도 핸들러 불필요
}
