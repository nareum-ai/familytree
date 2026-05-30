import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: 'famliytree-dfb80',
  appId: '1:284584296251:web:ea90ef0c0e0589f1d4011e',
  storageBucket: 'famliytree-dfb80.firebasestorage.app',
  apiKey: 'AIzaSyDwd55qGcb0KdRF6uE8zihiCB2GsVwWyQA',
  authDomain: 'famliytree-dfb80.firebaseapp.com',
  messagingSenderId: '284584296251',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
