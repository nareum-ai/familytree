import { getFirestore } from 'firebase-admin/firestore';

/** 회원의 아직 안 쓴 비밀번호 초기화 링크를 모두 무효화 (exceptId는 남김) */
export async function invalidateResetTokens(memberId: string, exceptId?: string) {
  const snap = await getFirestore().collection('password_reset_tokens')
    .where('member_id', '==', memberId).where('used', '==', false).get();
  await Promise.all(snap.docs.filter(d => d.id !== exceptId).map(d => d.ref.update({ used: true })));
}
