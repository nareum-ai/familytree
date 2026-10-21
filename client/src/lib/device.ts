/** 실행 환경(기기·브라우저) 감지 */

export function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** 카카오톡·네이버 등 인앱 브라우저 — 구글 로그인·Firestore WebSocket이 막히는 환경 */
export function isInAppBrowser(): boolean {
  return /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\/|Twitter/i.test(navigator.userAgent);
}

/** 홈 화면에 설치된 PWA/TWA로 실행 중 */
export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || !!(navigator as unknown as { standalone?: boolean }).standalone;
}

/** 설치되지 않은 iOS Safari — 홈 화면 추가 안내 대상 */
export function isIOSSafari(): boolean {
  return isIOS() && !/CriOS|FxiOS|OPiOS/i.test(navigator.userAgent) && !isStandalone();
}

export function isKakaoTalk(): boolean {
  return /KAKAOTALK/i.test(navigator.userAgent);
}

/** 카카오톡 인앱 브라우저에서 현재 URL을 기본 외부 브라우저(iOS Safari·Android Chrome)로 열기 */
export function openInExternalBrowserFromKakao(url = window.location.href) {
  window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
}
