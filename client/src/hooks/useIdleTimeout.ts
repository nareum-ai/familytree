import { useCallback, useEffect, useRef } from 'react';

const IDLE_MS = 5 * 60 * 1000;

const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;

export function useIdleTimeout(onLogout: () => void, active: boolean) {
  const logoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    if (logoutRef.current) clearTimeout(logoutRef.current);
    logoutRef.current = setTimeout(onLogout, IDLE_MS);
  }, [onLogout]);

  useEffect(() => {
    if (!active) return;
    EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      EVENTS.forEach(e => window.removeEventListener(e, reset));
      if (logoutRef.current) clearTimeout(logoutRef.current);
    };
  }, [active, reset]);
}
