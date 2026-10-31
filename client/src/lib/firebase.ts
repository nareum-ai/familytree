import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import {
  browserPopupRedirectResolver, getAuth, GoogleAuthProvider, inMemoryPersistence, initializeAuth,
} from 'firebase/auth';
import { getFunctions } from 'firebase/functions';
import { getMessaging, isSupported } from 'firebase/messaging';
import { getStorage } from 'firebase/storage';
import { SS } from './storageKeys';

const firebaseConfig = {
  apiKey: 'AIzaSyCMwRlXqDZxatmpe4fZKLyfYBi_hv4Udtw',
  authDomain: 'familytree-3221b.firebaseapp.com',
  projectId: 'familytree-3221b',
  storageBucket: 'familytree-3221b.firebasestorage.app',
  messagingSenderId: '237404804989',
  appId: '1:237404804989:web:2493070fb784a7f1b79e14',
  measurementId: 'G-TB4SGCZPY1',
};

// 관리자 PWA는 별도 앱 인스턴스 → 로그인 상태(IndexedDB)가 일반 앱과 분리된다
// (main.tsx보다 먼저 평가되므로 URL 파라미터도 직접 확인)
const isAdminPwa = sessionStorage.getItem(SS.ADMIN_PWA) === '1'
  || new URLSearchParams(window.location.search).get('admin_pwa') === '1';

const app = isAdminPwa ? initializeApp(firebaseConfig, 'admin-pwa') : initializeApp(firebaseConfig);
export const db = getFirestore(app);
/** 회원 세션 — 서버가 발급한 커스텀 토큰(uid = 회원 id)으로만 로그인 */
export const auth = getAuth(app);
export const functions = getFunctions(app, 'asia-northeast3');
export const storage = getStorage(app);

// Google 계정 확인 전용 — 팝업 결과(ID 토큰)만 서버에 넘기고 세션은 남기지 않는다
const googleApp = initializeApp(firebaseConfig, 'google-popup');
export const googleAuth = initializeAuth(googleApp, {
  persistence: inMemoryPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});
export const googleProvider = new GoogleAuthProvider();

// FCM — 지원 환경에서만 초기화
export const getMessagingInstance = async () => {
  const supported = await isSupported();
  if (!supported) return null;
  return getMessaging(app);
};
