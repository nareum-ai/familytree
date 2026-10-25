/** 회원 인증·계정 관련 Firestore 작업 (store 상태와 무관) */
import { addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, updateDoc, where } from 'firebase/firestore';
import { signInWithPopup } from 'firebase/auth';
import { v4 as uuidv4 } from 'uuid';
import { auth, db, googleProvider } from '../lib/firebase';
import { findDocs, getMemberData, grantInfoAccess, nowIso, updateMember } from '../lib/firestore';
import { getMemberId, getUserName } from '../lib/session';
import { hashPassword } from '../utils/crypto';
import type { Member } from '../types';

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1시간

function toMember(d: { id: string; data: () => unknown }): Member {
  return { id: d.id, ...(d.data() as Omit<Member, 'id'>) };
}

function newMemberFields() {
  return {
    person_id: null, family_id: null, person_name: null as string | null,
    is_admin: false, status: 'active' as const,
    created_at: nowIso(),
  };
}

// ── 아이디/비밀번호 ───────────────────────────────────────────────────────────

export async function registerMember(username: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const dup = await findDocs('members', where('username', '==', username));
  if (!dup.empty) return { ok: false, error: '이미 사용 중인 아이디입니다.' };
  await addDoc(collection(db, 'members'), {
    username,
    password_hash: await hashPassword(password),
    ...newMemberFields(),
  });
  return { ok: true };
}

export async function loginMember(username: string, password: string): Promise<Member | null> {
  const snap = await findDocs('members',
    where('username', '==', username),
    where('password_hash', '==', await hashPassword(password)));
  return snap.empty ? null : toMember(snap.docs[0]);
}

/** 현재 비밀번호 확인 후 변경 */
export async function changePassword(username: string, oldPassword: string, newPassword: string): Promise<'ok' | 'wrong-password'> {
  const member = await loginMember(username, oldPassword);
  if (!member) return 'wrong-password';
  await updateMember(member.id, { password_hash: await hashPassword(newPassword) });
  return 'ok';
}

/** 관리자 계정이 하나도 없으면 기본 관리자 계정 생성 */
export async function ensureAdminAccount() {
  const snap = await findDocs('members', where('is_admin', '==', true));
  if (!snap.empty) return;
  await addDoc(collection(db, 'members'), {
    username: '관리자',
    password_hash: await hashPassword('admin1234'),
    ...newMemberFields(),
    is_admin: true,
  });
}

// ── 비밀번호 초기화 ───────────────────────────────────────────────────────────

export async function createPasswordResetToken(memberId: string, extra: Record<string, unknown> = {}) {
  await addDoc(collection(db, 'password_reset_tokens'), {
    member_id:  memberId,
    token:      uuidv4(),
    expires_at: new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString(),
    used:       false,
    ...extra,
    created_at: nowIso(),
  });
}

/** 본인 정보(이름·생년월일·이메일)가 일치하면 초기화 토큰 발급 — 메일은 Cloud Function이 발송 */
export async function requestPasswordReset(
  username: string, personName: string, birthDate: string, email: string
): Promise<{ ok: boolean; notFound?: boolean }> {
  const snap = await findDocs('members', where('username', '==', username));
  if (snap.empty) return { ok: false, notFound: true };
  const memberDoc = snap.docs[0];
  const data = memberDoc.data();
  if ((data.person_name ?? '') !== personName) return { ok: false, notFound: false };

  // 생년월일/이메일은 연결된 persons 문서에서 확인 (생년월일 미등록이면 빈 값끼리 일치)
  if (!data.person_id) return { ok: false, notFound: false };
  const personSnap = await getDoc(doc(db, 'persons', data.person_id as string));
  if (!personSnap.exists()) return { ok: false, notFound: false };
  const pd = personSnap.data();
  if ((pd.birth_date ?? '') !== birthDate || (pd.email ?? '') !== email) return { ok: false, notFound: false };

  await createPasswordResetToken(memberDoc.id);
  return { ok: true };
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const snap = await findDocs('password_reset_tokens',
    where('token', '==', token),
    where('used', '==', false));
  if (snap.empty) return { ok: false, error: '유효하지 않은 링크입니다.' };
  const tokenDoc = snap.docs[0];
  const data = tokenDoc.data();
  if (new Date(data.expires_at as string) < new Date()) {
    return { ok: false, error: '만료된 링크입니다. 다시 요청해주세요.' };
  }
  await Promise.all([
    updateMember(data.member_id as string, { password_hash: await hashPassword(newPassword) }),
    updateDoc(tokenDoc.ref, { used: true }),
  ]);
  return { ok: true };
}

export async function requestAdminPasswordReset(username: string, personName: string, contactEmail: string, message?: string) {
  await addDoc(collection(db, 'password_reset_requests'), {
    username,
    person_name:   personName,
    contact_email: contactEmail,
    message:       message ?? null,
    status:        'pending',
    created_at:    nowIso(),
  });
}

// ── 구글 ──────────────────────────────────────────────────────────────────────

export interface GoogleUser { uid: string; email: string; displayName: string }

/** 구글 팝업 로그인. 사용자가 팝업을 닫거나 취소하면 null */
export async function signInWithGoogle(): Promise<GoogleUser | null> {
  try {
    const { user } = await signInWithPopup(auth, googleProvider);
    const email = user.email ?? '';
    return { uid: user.uid, email, displayName: user.displayName ?? email };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null;
    throw err;
  }
}

/** 구글 로그인 후 연결된 회원 조회 (없으면 member: null). 팝업 취소 시 null
 *  onAuthenticated: 계정 선택이 끝나 회원 조회를 시작하는 시점 (로딩 화면 전환용) */
export async function loginWithGoogle(onAuthenticated?: () => void): Promise<{ member: Member | null; googleUid: string; googleEmail: string; displayName: string } | null> {
  const google = await signInWithGoogle();
  if (!google) return null;
  onAuthenticated?.();
  const snap = await findDocs('members', where('google_uid', '==', google.uid));
  return {
    member: snap.empty ? null : toMember(snap.docs[0]),
    googleUid: google.uid, googleEmail: google.email, displayName: google.displayName,
  };
}

export async function registerWithGoogle(googleUid: string, googleEmail: string, displayName: string): Promise<Member> {
  const fields = {
    username:      googleEmail,
    password_hash: '',
    google_uid:    googleUid,
    google_email:  googleEmail,
    ...newMemberFields(),
    person_name:   displayName || null,
  };
  const ref = await addDoc(collection(db, 'members'), fields);
  return { id: ref.id, ...fields };
}

export async function linkGoogleToMember(memberId: string, googleUid: string, googleEmail: string): Promise<{ ok: boolean; error?: string }> {
  // 동일 google_uid가 다른 계정에 이미 연결되어 있는지 확인
  const snap = await findDocs('members', where('google_uid', '==', googleUid));
  if (snap.docs.some(d => d.id !== memberId)) {
    return { ok: false, error: '이 구글 계정은 이미 다른 계정에 연결되어 있습니다.' };
  }
  await updateMember(memberId, { google_uid: googleUid, google_email: googleEmail });
  return { ok: true };
}

/** 구글 팝업 → 회원 계정에 연결. 팝업 취소 시 null */
export async function linkGoogleAccount(memberId: string): Promise<{ ok: boolean; email: string; error?: string } | null> {
  const google = await signInWithGoogle();
  if (!google) return null;
  const res = await linkGoogleToMember(memberId, google.uid, google.email);
  return { ...res, email: google.email };
}

export function unlinkGoogleFromMember(memberId: string) {
  return updateMember(memberId, { google_uid: null, google_email: null });
}

// ── 기기·접속 기록 ────────────────────────────────────────────────────────────

export type PushScope = 'user' | 'admin';

/** 기기 토큰 저장 필드 — 배열(다중 기기) + 구버전 단일 필드(하위호환) */
export function fcmTokenFields(scope: PushScope) {
  return scope === 'admin'
    ? { arr: 'fcm_tokens_admin', legacy: 'fcm_token_admin' }
    : { arr: 'fcm_tokens',       legacy: 'fcm_token' };
}

/**
 * 현재 기기 FCM 토큰을 회원 문서에 추가한다 (기존 기기 토큰은 유지).
 * - 같은 토큰이 다른 회원에 있으면 그쪽에서 제거 (기기를 다른 계정이 쓰게 된 경우)
 * - 이 기기의 이전 토큰(prevToken)이 바뀌었으면 제거 (중복 수신 방지)
 */
export async function saveFcmToken(memberId: string, token: string, scope: PushScope = 'user', prevToken?: string | null) {
  const { arr, legacy } = fcmTokenFields(scope);
  const [dupArr, dupLegacy] = await Promise.all([
    findDocs('members', where(arr, 'array-contains', token)),
    findDocs('members', where(legacy, '==', token)),
  ]);
  for (const d of dupArr.docs)    if (d.id !== memberId) await updateMember(d.id, { [arr]: arrayRemove(token) });
  for (const d of dupLegacy.docs) if (d.id !== memberId) await updateMember(d.id, { [legacy]: null });

  // 같은 필드에 arrayRemove·arrayUnion을 한 번에 쓸 수 없어 2회로 나눈다
  if (prevToken && prevToken !== token) await updateMember(memberId, { [arr]: arrayRemove(prevToken) });
  await updateMember(memberId, {
    [arr]: arrayUnion(token),
    [legacy]: token,
    fcm_tokens_updated_at: nowIso(),
  });
}

/** 서버 테스트 푸시 요청 — Functions(onPushTestCreated)가 발송 후 결과를 문서에 기록 */
export async function requestServerPushTest(memberId: string, scope: PushScope = 'user') {
  const ref = await addDoc(collection(db, 'push_tests'), {
    member_id: memberId, scope, created_at: nowIso(), done: false,
  });
  return ref.id;
}

export async function recordLogin(memberId: string) {
  const now = nowIso();
  await Promise.all([
    updateMember(memberId, { last_login_at: now }),
    addDoc(collection(db, 'login_logs'), {
      member_id:    memberId,
      logged_in_at: now,
      user_agent:   navigator.userAgent,
    }),
  ]);
}

// ── 가족집단 신청 ─────────────────────────────────────────────────────────────

export async function checkPendingFamilyRequest(): Promise<{ id: string; realName: string; createdAt: string } | null> {
  const memberId = getMemberId();
  if (!memberId) return null;
  const snap = await findDocs('approval_requests',
    where('member_id', '==', memberId),
    where('status',    '==', 'pending'));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return {
    id:        d.id,
    realName:  d.data().requested_name as string,
    createdAt: d.data().created_at as string,
  };
}

export function cancelFamilyGroupRequest(requestId: string) {
  return deleteDoc(doc(db, 'approval_requests', requestId));
}

export async function submitFamilyGroupRequest(
  realName: string, description: string,
  gender: 'male' | 'female', birthDate: string | null, birthLunar: boolean
) {
  const memberId = getMemberId();
  if (!memberId) return;

  // 이미 family_id가 있는 계정은 신청 불가 (루트 계정 포함)
  if ((await getMemberData(memberId))?.family_id) return;

  // 대기 중인 신청이 있으면 중복 삽입 방지 (pending·approved 모두 포함)
  const existing = await findDocs('approval_requests', where('member_id', '==', memberId));
  if (existing.docs.some(d => ['pending', 'approved'].includes(d.data().status))) return;
  await addDoc(collection(db, 'approval_requests'), {
    requested_name:  realName,
    description,
    gender,
    birth_date:      birthDate,
    birth_lunar:     birthLunar,
    member_id:       memberId,
    member_username: getUserName(),
    status:          'pending',
    created_at:      nowIso(),
  });
}

// ── 초대·가족 상태 ────────────────────────────────────────────────────────────

/** 초대 사용 처리 — 삭제하지 않고 used_at을 남겨, 같은 링크로 다시 들어왔을 때 '이미 가입됨'으로 안내 */
export async function consumeInviteToken(token: string) {
  const snap = await findDocs('invites', where('token', '==', token));
  await Promise.all(snap.docs.map(d => updateDoc(d.ref, {
    used_at: nowIso(),
    used_by_member_id: getMemberId() ?? null,
  })));
}

export async function mapMemberToPerson(memberId: string, personId: string, familyId: string, personName: string) {
  // 다른 계정이 이미 이 person_id에 매핑돼 있으면 거부
  const existingSnap = await findDocs('members', where('person_id', '==', personId));
  if (existingSnap.docs.some(d => d.id !== memberId)) throw new Error('ALREADY_MAPPED');

  await updateMember(memberId, { person_id: personId, family_id: familyId, person_name: personName });

  // 이 인물과 합의된 양방향 페어가 있으면 즉시 접근권 부여
  const [pairsA, pairsB] = await Promise.all([
    findDocs('person_access_pairs', where('person_a_id', '==', personId)),
    findDocs('person_access_pairs', where('person_b_id', '==', personId)),
  ]);
  const partnerIds = [
    ...pairsA.docs.map(d => d.data().person_b_id as string),
    ...pairsB.docs.map(d => d.data().person_a_id as string),
  ];
  for (const partnerId of partnerIds) await grantInfoAccess(memberId, partnerId);
}

/** 가족 안에서 이미 계정과 연결된 인물 id 목록 */
export async function getMappedPersonIds(familyId: string): Promise<Set<string>> {
  const snap = await findDocs('members', where('family_id', '==', familyId));
  return new Set(snap.docs.map(d => d.data().person_id as string | null).filter((id): id is string => !!id));
}

export async function isPersonMapped(personId: string): Promise<boolean> {
  const snap = await findDocs('members', where('person_id', '==', personId));
  return !snap.empty;
}

export async function isFamilyDisabled(familyId: string): Promise<boolean> {
  const snap = await findDocs('persons',
    where('family_id', '==', familyId),
    where('is_root', '==', 1));
  return !snap.empty && !!snap.docs[0].data().family_disabled;
}
