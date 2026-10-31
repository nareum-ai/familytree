/** 푸시 알림(FCM) 권한·토큰 등록 */
import { getToken, isSupported } from 'firebase/messaging';
import { getMessagingInstance } from './firebase';
import { LS, SS } from './storageKeys';
import { isAdminSession } from './session';
import { updateMember } from './firestore';
import { saveFcmToken, type PushScope } from '../services/authService';

export const VAPID_KEY = 'BLRyRDSVY-2HCMviKpkqFKB2Nf2WHLipd2dh6WdQSK7thzEVX1UNENkr9oviMKeqFhgmELvbpD0yIrJm2xgLz-g';

/** 토큰이 그대로여도 이 주기마다 회원 문서에 다시 기록 (서버 쪽 누락·정리 대비) */
const RESAVE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 관리자 PWA·관리자 로그인은 별도 필드(fcm_tokens_admin)에 토큰을 저장한다.
 * 같은 기기에서 관리자와 일반 계정을 오가도 일반 계정의 토큰(fcm_tokens)이 지워지지 않아 둘 다 수신된다.
 */
export function pushScope(): PushScope {
  return sessionStorage.getItem(SS.ADMIN_PWA) === '1' || isAdminSession() ? 'admin' : 'user';
}

/** 이 브라우저가 웹푸시를 지원하는지 (iOS는 홈 화면 앱에서만 true) */
export async function isPushSupported(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) return false;
  try { return await isSupported(); } catch { return false; }
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

interface SavedToken { memberId: string; scope: PushScope; token: string; at: number; }

function readSaved(): SavedToken | null {
  const raw = localStorage.getItem(LS.FCM_TOKEN_SAVED);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as SavedToken;
    if (v && typeof v.token === 'string') return v;
  } catch { /* 구버전: 토큰 문자열만 저장돼 있음 */ }
  return { memberId: '', scope: 'user', token: raw, at: 0 };
}

/** 이 기기가 실제로 푸시를 받을 수 있게 등록돼 있는지 (권한 허용 + 토큰 저장) */
export function isDeviceRegistered(): boolean {
  return notificationPermission() === 'granted' && !!getSavedToken();
}

export function getSavedToken(): string | null {
  return readSaved()?.token ?? null;
}

/**
 * 현재 기기의 FCM 토큰을 발급받아 회원 문서에 저장한다.
 * 권한이 이미 허용된 상태에서만 호출할 것 (권한 요청은 하지 않음).
 * 회원·범위가 바뀌었거나, 토큰이 바뀌었거나, 마지막 저장 후 7일이 지났으면 저장한다.
 */
export async function syncFcmToken(memberId: string, opts: { force?: boolean } = {}): Promise<string | null> {
  const messaging = await getMessagingInstance();
  if (!messaging) return null;
  const swReg = await navigator.serviceWorker.ready;
  const saved = readSaved();
  const scope = pushScope();

  // 처음 등록하는 기기: 남아있는 구독을 해제 후 재등록 (TWA permission-blocked 우회)
  if (!saved) {
    const existingSub = await swReg.pushManager.getSubscription();
    if (existingSub) await existingSub.unsubscribe().catch(() => {});
  }

  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
  if (!token) return null;

  const fresh = saved
    && saved.token === token && saved.memberId === memberId && saved.scope === scope
    && Date.now() - saved.at < RESAVE_MS;
  if (fresh && !opts.force) return token;

  await saveFcmToken(memberId, token, scope, saved?.token);
  rememberSavedToken(memberId, scope, token);
  return token;
}

export function rememberSavedToken(memberId: string, scope: PushScope, token: string) {
  localStorage.setItem(LS.FCM_TOKEN_SAVED, JSON.stringify({ memberId, scope, token, at: Date.now() } satisfies SavedToken));
}

/** 권한이 없으면 요청한다. 최종적으로 허용됐으면 true. 반드시 버튼 클릭 등 사용자 동작 안에서 호출할 것 */
async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
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
  if (memberId) await syncFcmToken(memberId, { force: true }).catch(() => null);
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
