import { useEffect, useState } from 'react';
import { onMessage } from 'firebase/messaging';
import { getMessagingInstance } from '../lib/firebase';
import { isAdminReturn } from '../lib/session';
import { notificationPermission, syncFcmToken } from '../lib/pushNotifications';

const SYNC_DELAY_MS = 3000; // 첫 화면 렌더를 방해하지 않도록 약간 늦춤

/**
 * 앱 시작 시 FCM 토큰 동기화.
 * 권한을 직접 묻지 않는다 — 권한 요청은 사용자 버튼(PushPermissionPrompt, 기념일 알림 토글)에서만 한다.
 * (iOS 홈 화면 앱은 사용자 동작 없이 requestPermission을 호출하면 조용히 실패하고,
 *  크롬도 자동 요청은 눈에 안 띄게 숨기는 경우가 많다)
 */
export function useFCMToken(memberId: string | null) {
  // 로그인은 reload 없이 이뤄지므로 memberId가 바뀌면 다시 동기화
  useEffect(() => {
    if (!memberId || isAdminReturn()) return;
    if (notificationPermission() !== 'granted') return;

    const timer = setTimeout(() => {
      syncFcmToken(memberId).catch(() => { /* 지원 안되는 환경 — 조용히 무시 */ });
    }, SYNC_DELAY_MS);
    return () => clearTimeout(timer);
  }, [memberId]);
}

export interface ForegroundPush { id: number; title: string; body: string; link: string; }

/**
 * 앱을 보고 있는 동안(포그라운드) 도착한 푸시 처리.
 * 화면이 보이는 상태면 FCM이 서비스 워커 대신 페이지로 메시지를 넘기므로,
 * 여기서 처리하지 않으면 알림이 그대로 사라진다.
 * → 시스템 알림 표시 + 앱 내 토스트용 상태 반환
 */
export function useForegroundPush(): [ForegroundPush | null, () => void] {
  const [current, setCurrent] = useState<ForegroundPush | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    getMessagingInstance().then(messaging => {
      if (!messaging || cancelled) return;
      unsub = onMessage(messaging, async (payload) => {
        const d = (payload.data ?? {}) as Record<string, string>;
        const title = d.title || payload.notification?.title || '우리 가족 가계도';
        const body  = d.body  || payload.notification?.body  || '';
        const link  = d.link  || '/';
        setCurrent({ id: Date.now(), title, body, link });
        try {
          const reg = await navigator.serviceWorker.ready;
          await reg.showNotification(title, {
            body,
            icon: '/icons/icon-192.png',
            data: { url: link },
            ...(d.tag ? { tag: d.tag } : {}),
          });
        } catch { /* 토스트만 표시 */ }
      });
    }).catch(() => {});
    return () => { cancelled = true; unsub?.(); };
  }, []);

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => setCurrent(null), 6000);
    return () => clearTimeout(t);
  }, [current]);

  return [current, () => setCurrent(null)];
}
