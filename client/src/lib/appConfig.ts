/**
 * 앱 배포 상태 플래그 — vite.config.ts(매니페스트)와 클라이언트 코드가 함께 참조한다.
 *
 * PLAY_STORE_RELEASED: Play 스토어(TWA) 앱 공개 출시 여부.
 *   false → Play 스토어 유도 전부 숨김, Android는 브라우저 알림 + PWA 설치 안내
 *   true  → 매니페스트 related_applications/prefer_related_applications 적용,
 *           Android 브라우저에서 Play 앱 설치·열기 안내
 *   출시 후 true로 바꾸고 build + deploy.
 */
export const PLAY_STORE_RELEASED = false;

export const ANDROID_PACKAGE = 'app.web.familytree_3221b.twa';
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
