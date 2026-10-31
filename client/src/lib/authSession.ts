/** 앱 시작 시 Firebase Auth 세션과 localStorage 세션을 맞춘다 (렌더 전 1회) */
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import { getMemberData } from './firestore';
import { LS } from './storageKeys';
import { clearSession, getMemberId, getUserName, isAdminContext, startFamilySession } from './session';
import { refreshSession } from '../services/authService';

export async function syncAuthSession() {
  await auth.authStateReady();
  const user = auth.currentUser;
  const hasLocal = !!(getUserName() || getMemberId() || isAdminContext());

  if (!user) {
    // 보안 규칙 강화 전의 로그인 상태 등 — 서버 세션이 없으면 다시 로그인
    if (hasLocal) clearSession();
    return;
  }
  const claims = (await user.getIdTokenResult()).claims;
  const valid = isAdminContext() ? claims.adm === true : !!getMemberId() && user.uid === getMemberId();
  if (!hasLocal || !valid) {
    clearSession();
    await signOut(auth).catch(() => {});
    return;
  }
  if (isAdminContext()) return;

  try {
    const familyId = localStorage.getItem(LS.FAMILY_ID);
    if (!familyId) {
      // 가족 신청이 승인됐으면 다시 로그인하지 않아도 바로 가계도로
      const m = await getMemberData(user.uid);
      if (!m?.family_id || !m.person_id) return;
      const member = await refreshSession();
      if (!member?.family_id || !member.person_id) return;
      startFamilySession({
        userName: member.person_name ?? member.username,
        familyId: member.family_id,
        personId: member.person_id,
        memberId: member.id,
        accountName: member.username,
      });
    } else if (claims.fid !== familyId) {
      await refreshSession();
    }
  } catch { /* 네트워크 오류 — 다음 실행 때 다시 맞춘다 */ }
}
