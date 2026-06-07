import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

const MAX_SIZE = 512;

function resizeToBlob(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SIZE / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas context 생성 실패')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('이미지 변환 실패')),
        'image/jpeg',
        0.85
      );
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('이미지를 불러올 수 없습니다.'));
    img.src = URL.createObjectURL(file);
  });
}

export async function uploadAvatarPhoto(file: File): Promise<string> {
  const blob = await resizeToBlob(file);
  const path = `avatars/uploads/${crypto.randomUUID()}.jpg`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(storageRef);
}
