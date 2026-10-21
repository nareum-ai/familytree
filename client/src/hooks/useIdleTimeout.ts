import { useCallback, useEffect, useRef } from 'react';
import { LS } from '../lib/storageKeys';

const IDLE_MS = 10 * 60 * 1000;

const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;

export function useIdleTimeout(onLogout: () => void, active: boolean) {
  const logoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    localStorage.setItem(LS.LAST_ACTIVITY, String(Date.now()));
    if (logoutRef.current) clearTimeout(logoutRef.current);
    logoutRef.current = setTimeout(onLogout, IDLE_MS);
  }, [onLogout]);

  // 마지막 활동 시각 기준으로 경과 시간을 확인 — 앱이 백그라운드/종료되어
  // setTimeout이 동작하지 않았던 동안의 유휴 시간도 여기서 잡아낸다
  const checkElapsed = useCallback(() => {
    const last = Number(localStorage.getItem(LS.LAST_ACTIVITY) ?? 0);
    if (last && Date.now() - last >= IDLE_MS) {
      onLogout();
    } else {
      reset();
    }
  }, [onLogout, reset]);

  useEffect(() => {
    if (!active) return;
    checkElapsed();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkElapsed();
    };

    EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }));
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      EVENTS.forEach(e => window.removeEventListener(e, reset));
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (logoutRef.current) clearTimeout(logoutRef.current);
    };
  }, [active, reset, checkElapsed]);
}
