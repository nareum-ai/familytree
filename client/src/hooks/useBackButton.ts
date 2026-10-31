import { useEffect, useRef, useState } from 'react';

const EXIT_CONFIRM_MS = 2500;

/**
 * 안드로이드 뒤로가기 처리: 열린 모달이 있으면 닫고, 없으면 "한 번 더 누르면 종료" 이중 확인.
 * @param closeTopModal 열린 모달을 하나 닫았으면 true
 * @returns 종료 안내 토스트 표시 여부
 */
export function useBackButton(active: boolean, closeTopModal: () => boolean): boolean {
  const [showExitToast, setShowExitToast] = useState(false);

  // popstate 핸들러가 항상 최신 모달 상태를 보도록 ref로 보관
  const closeTopModalRef = useRef(closeTopModal);
  useEffect(() => { closeTopModalRef.current = closeTopModal; });

  useEffect(() => {
    if (!active) return;
    let backPressed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    history.pushState(null, '', window.location.href);

    const onPopState = () => {
      // 열린 모달이 있으면 닫고 히스토리 재삽입
      if (closeTopModalRef.current()) {
        history.pushState(null, '', window.location.href);
        return;
      }
      // 모달 없음 → 이중 확인 후 종료
      if (backPressed) return;
      history.pushState(null, '', window.location.href);
      backPressed = true;
      setShowExitToast(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        backPressed = false;
        setShowExitToast(false);
      }, EXIT_CONFIRM_MS);
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      if (timer) clearTimeout(timer);
    };
  }, [active]);

  return showExitToast;
}
