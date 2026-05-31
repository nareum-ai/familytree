import { useEffect, useState } from 'react';

/** 관리자 계정의 google_email을 Firestore에서 조회하는 훅 */
export function useAdminEmail(): string | null {
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { getDocs, collection, query, where } = await import('firebase/firestore');
        const { db } = await import('../lib/firebase');
        const snap = await getDocs(
          query(collection(db, 'members'), where('is_admin', '==', true))
        );
        const email = snap.docs[0]?.data()?.google_email as string | undefined;
        if (email) setAdminEmail(email);
      } catch { /* 무시 */ }
    })();
  }, []);

  return adminEmail;
}
