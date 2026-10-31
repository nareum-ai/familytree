import { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

/** 관리자 계정에 구글 이메일이 연결되어 있지 않을 때 쓰는 문의 주소 (선택) */
const FALLBACK_EMAIL = (import.meta.env.VITE_CONTACT_EMAIL as string | undefined) || null;

// 관리자 이메일은 세션 중 바뀌지 않으므로 한 번만 조회해 공유
let adminEmailPromise: Promise<string | null> | null = null;

function fetchAdminEmail(): Promise<string | null> {
  // 회원 문서는 비공개라 서버가 구글 이메일이 연결된 관리자 주소만 알려준다 (로그인 전에도 사용)
  adminEmailPromise ??= httpsCallable<unknown, { email: string | null }>(functions, 'getAdminContact')({})
    .then(r => r.data.email ?? FALLBACK_EMAIL)
    .catch(() => { adminEmailPromise = null; return FALLBACK_EMAIL; });
  return adminEmailPromise;
}

/** 관리자 문의 이메일과 조회 중 여부 */
export function useAdminEmailStatus(): { email: string | null; loading: boolean } {
  const [state, setState] = useState<{ email: string | null; loading: boolean }>({ email: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    fetchAdminEmail().then(email => { if (!cancelled) setState({ email, loading: false }); });
    return () => { cancelled = true; };
  }, []);

  return state;
}

/** 관리자 계정의 google_email (문의 안내용) */
export function useAdminEmail(): string | null {
  return useAdminEmailStatus().email;
}
