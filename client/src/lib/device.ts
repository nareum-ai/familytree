import { ANDROID_PACKAGE, PLAY_STORE_RELEASED, PLAY_STORE_URL } from './appConfig';
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

export function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

export type IOSBrowser = 'safari' | 'chrome' | 'edge' | 'firefox' | 'other';
export function iosBrowser(): IOSBrowser {
  const ua = navigator.userAgent;
  if (/CriOS/i.test(ua)) return 'chrome';
  if (/EdgiOS/i.test(ua)) return 'edge';
  if (/FxiOS/i.test(ua)) return 'firefox';
  if (/OPiOS/i.test(ua)) return 'other';
  return 'safari';
}

/**
 * 홈 화면 추가 안내 대상 iOS 브라우저.
 * iOS 16.4부터 Safari 외 브라우저(크롬·엣지 등)도 공유 메뉴에서 홈 화면에 추가할 수 있다.
 * 인앱 브라우저(카카오톡 등)는 외부 브라우저 열기 안내가 먼저이므로 제외.
 */
export function canAddToHomeScreenIOS(): boolean {
  return isIOS() && !isStandalone() && !isInAppBrowser();
}

// ── Play 스토어(TWA) — 출시 전에는 appConfig.PLAY_STORE_RELEASED=false 로 전부 비활성 ──
export { ANDROID_PACKAGE, PLAY_STORE_RELEASED, PLAY_STORE_URL };

/** Android 브라우저(앱 아님)에서 Play 스토어 앱 안내를 보여줄지 */
export function shouldOfferPlayApp(): boolean {
  return PLAY_STORE_RELEASED && isAndroid() && !isStandalone();
}

/** Android 브라우저에서 설치된 TWA 앱으로 현재 사이트 열기 (앱 없으면 Play 스토어로) */
export function openInAndroidApp(path = '/') {
  const fallback = encodeURIComponent(PLAY_STORE_URL);
  window.location.href =
    `intent://${window.location.host}${path}#Intent;scheme=https;package=${ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`;
}

/** Android 브라우저에서 Play 스토어 앱이 이미 설치돼 있는지 (지원 안 되면 false) */
export async function isAndroidAppInstalled(): Promise<boolean> {
  if (!PLAY_STORE_RELEASED) return false;
  const nav = navigator as unknown as { getInstalledRelatedApps?: () => Promise<Array<{ id?: string; platform: string }>> };
  if (!nav.getInstalledRelatedApps) return false;
  try {
    const apps = await nav.getInstalledRelatedApps();
    return apps.some(a => a.platform === 'play' && (!a.id || a.id === ANDROID_PACKAGE));
  } catch { return false; }
}
