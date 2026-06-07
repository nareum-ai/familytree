import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getMessaging, isSupported } from 'firebase/messaging';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyCMwRlXqDZxatmpe4fZKLyfYBi_hv4Udtw',
  authDomain: 'familytree-3221b.firebaseapp.com',
  projectId: 'familytree-3221b',
  storageBucket: 'familytree-3221b.firebasestorage.app',
  messagingSenderId: '237404804989',
  appId: '1:237404804989:web:2493070fb784a7f1b79e14',
  measurementId: 'G-TB4SGCZPY1',
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// FCM — 지원 환경에서만 초기화
export const getMessagingInstance = async () => {
  const supported = await isSupported();
  if (!supported) return null;
  return getMessaging(app);
};
