/** 푸시 알림(FCM) 권한·토큰 등록 */
import { getToken } from 'firebase/messaging';
import { getMessagingInstance } from './firebase';
import { LS, SS } from './storageKeys';
import { updateMember } from './firestore';
import { saveFcmToken } from '../services/authService';

export const VAPID_KEY = 'BLRyRDSVY-2HCMviKpkqFKB2Nf2WHLipd2dh6WdQSK7thzEVX1UNENkr9oviMKeqFhgmELvbpD0yIrJm2xgLz-g';

/** 관리자 PWA는 별도 필드에 토큰을 저장한다 */
export function fcmTokenField(): 'fcm_token' | 'fcm_token_admin' {
  return sessionStorage.getItem(SS.ADMIN_PWA) === '1' ? 'fcm_token_admin' : 'fcm_token';
}

/** 권한이 없으면 요청한다. 최종적으로 허용됐으면 true */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Notification.permission === 'granted') return true;
  return (await Notification.requestPermission()) === 'granted';
}

/** 현재 기기의 FCM 토큰을 발급받아 회원 문서에 저장 */
export async function registerFcmToken(memberId: string, swReg: ServiceWorkerRegistration) {
  const messaging = await getMessagingInstance();
  if (!messaging) return;
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
  if (!token) return;
  await saveFcmToken(memberId, token, 'fcm_token');
  localStorage.setItem(LS.FCM_TOKEN_SAVED, token);
}

/**
 * 알림 켜기: 권한 요청 → 토큰 등록 → 테스트 알림 표시.
 * 권한 API 값과 무관하게 실제로 알림이 화면에 뜨는지 사용자에게 확인받기 위해 테스트 알림을 띄운다
 * (TWA에서는 Notification.permission이 안드로이드 시스템 알림 권한과 어긋나는 경우가 있음).
 * @returns granted: 권한 허용 여부, testShown: 테스트 알림을 띄웠는지
 */
export async function enablePushOnDevice(memberId: string | null): Promise<{ granted: boolean; testShown: boolean }> {
  if (!(await ensureNotificationPermission())) return { granted: false, testShown: false };
  const swReg = await navigator.serviceWorker.ready;
  if (memberId) await registerFcmToken(memberId, swReg);
  try {
    await swReg.showNotification('🔔 알림 테스트', {
      body: '이 알림이 보이면 정상적으로 작동하고 있어요!',
      icon: '/icons/icon-192.png',
      tag: 'notif-test',
    });
    return { granted: true, testShown: true };
  } catch {
    return { granted: true, testShown: false };
  }
}

export function setPushEnabled(memberId: string, enabled: boolean) {
  return updateMember(memberId, { 'push_prefs.enabled': enabled });
}
