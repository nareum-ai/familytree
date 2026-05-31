import { useEffect } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { getMessagingInstance } from '../lib/firebase';
import { useFamilyStore } from '../store/familyStore';
import { LS } from '../lib/storageKeys';

const VAPID_KEY = 'BLRyRDSVY-2HCMviKpkqFKB2Nf2WHLipd2dh6WdQSK7thzEVX1UNENkr9oviMKeqFhgmELvbpD0yIrJm2xgLz-g';

/** PWA(홈 화면 설치)로 실행 중인지 감지 */
function isPWA(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export function useFCMToken() {
  const { saveFcmToken } = useFamilyStore();

  // PWA에서만 알림 권한 요청 + 토큰 저장
  useEffect(() => {
    const memberId = localStorage.getItem(LS.MEMBER_ID);
    const isAdmin  = localStorage.getItem(LS.IS_ADMIN) === 'true';
    if (!memberId || isAdmin || !isPWA()) return;

    const setup = async () => {
      const messaging = await getMessagingInstance();
      if (!messaging) return;
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;
        const swReg = await navigator.serviceWorker.ready;
        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: swReg,
        });
        if (token) await saveFcmToken(memberId, token);
      } catch {
        // 지원 안되는 환경이거나 거부 — 조용히 무시
      }
    };

    // 로그인 후 5초 뒤 요청 (즉시 뜨면 거부율 높음)
    const timer = setTimeout(setup, 5000);
    return () => clearTimeout(timer);
  }, []);

  // 포그라운드 알림 (앱 열려있을 때)
  useEffect(() => {
    if (!isPWA()) return;
    let unsub: (() => void) | undefined;
    getMessagingInstance().then((messaging) => {
      if (!messaging) return;
      unsub = onMessage(messaging, (payload) => {
        const { title = '알림', body = '' } = payload.notification ?? {};
        if (Notification.permission === 'granted') {
          new Notification(title, { body, icon: '/icons/icon-192.png' });
        }
      });
    });
    return () => unsub?.();
  }, []);
}
