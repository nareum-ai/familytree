/** 회원 인증·계정 관련 작업 (store 상태와 무관)
 *  로그인·가입·비밀번호·Google 연결·초대 수락은 Cloud Functions(callable)가 처리하고,
 *  서버가 발급한 커스텀 토큰으로 Firebase Auth 세션을 연다 (uid = 회원 id, 클레임 fid·adm).
 *  Firestore 보안 규칙이 이 세션으로 가족·본인 데이터만 허용한다. */
import { addDoc, collection, deleteDoc, doc, where } from 'firebase/firestore';
import { signInWithCustomToken, signInWithPopup, signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { v4 as uuidv4 } from 'uuid';
import { auth, db, functions, googleAuth, googleProvider } from '../lib/firebase';
import { findDocs, getMemberData, nowIso, updateMember } from '../lib/firestore';
import { getMemberId, getUserName } from '../lib/session';
import type { Member } from '../types';

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1시간

function call<T>(name: string, data: unknown = {}): Promise<T> {
  return httpsCallable<unknown, T>(functions, name)(data).then(r => r.data);
}

interface SessionResult { token?: string; member?: Member | null; error?: string }

/** 서버가 준 토큰으로 세션 시작 */
async function openSession(res: SessionResult): Promise<Member | null> {
  if (!res.token || !res.member) return null;
  await signInWithCustomToken(auth, res.token);
  return res.member;
}

/** 회원 정보(가족 배정 등)가 바뀐 뒤 세션 클레임 갱신 */
export async function refreshSession(): Promise<Member | null> {
  return openSession(await call<SessionResult>('refreshSession'));
}

export function endSession() {
  return signOut(auth).catch(() => {});
}

// ── 아이디/비밀번호 ───────────────────────────────────────────────────────────

export async function registerMember(username: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const res = await call<{ ok?: boolean; error?: string }>('authRegister', { username, password });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

export type LoginError = 'invalid' | 'locked' | 'suspended';

/** 로그인 성공 시 세션을 열고 회원 정보 반환 */
export async function loginMember(username: string, password: string): Promise<{ member?: Member; error?: LoginError }> {
  const res = await call<SessionResult>('authLogin', { username, password });
  if (res.error) return { error: res.error as LoginError };
  const member = await openSession(res);
  return member ? { member } : { error: 'invalid' };
}

export const LOGIN_ERROR_MSG: Record<LoginError, string> = {
  invalid:   '아이디 또는 비밀번호가 올바르지 않습니다.',
  locked:    '비밀번호를 여러 번 틀려 10분간 로그인이 제한됩니다.',
  suspended: '이용이 정지된 계정입니다. 관리자에게 문의하세요.',
};

/** 현재 비밀번호 확인 후 변경 (로그인한 본인) */
export async function changePassword(oldPassword: string, newPassword: string): Promise<'ok' | 'wrong-password'> {
  const res = await call<{ ok?: boolean; error?: string }>('changePassword', { oldPassword, newPassword });
  if (res.ok) return 'ok';
  if (res.error === 'wrong-password') return 'wrong-password';
  throw new Error(res.error ?? 'failed');
}

// ── 비밀번호 초기화 ───────────────────────────────────────────────────────────

/** 관리자 승인 경로 — 관리자 세션에서만 호출 (메일은 Cloud Function이 발송) */
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

/** 본인 정보(이름·생년월일·이메일)가 일치하면 초기화 메일 발송 */
export function requestPasswordReset(
  username: string, personName: string, birthDate: string, email: string
): Promise<{ ok: boolean; notFound?: boolean }> {
  return call('requestPasswordReset', { username, personName, birthDate, email });
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const res = await call<{ ok?: boolean; error?: string }>('resetPassword', { token, newPassword });
  return { ok: !!res.ok, error: res.error };
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

export interface GoogleUser { idToken: string; email: string; displayName: string }

/** 구글 팝업으로 계정 확인 (세션은 열지 않음). 사용자가 팝업을 닫거나 취소하면 null */
async function signInWithGoogle(): Promise<GoogleUser | null> {
  try {
    const { user } = await signInWithPopup(googleAuth, googleProvider);
    const email = user.email ?? '';
    const google = { idToken: await user.getIdToken(), email, displayName: user.displayName ?? email };
    signOut(googleAuth).catch(() => {});
    return google;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null;
    throw err;
  }
}

/** 구글 로그인. 연결된 회원이 있으면 세션을 열고 member 반환, 없으면 member: null. 팝업 취소 시 null
 *  onAuthenticated: 계정 선택이 끝나 회원 조회를 시작하는 시점 (로딩 화면 전환용) */
export async function loginWithGoogle(onAuthenticated?: () => void): Promise<{ member: Member | null; error?: LoginError; google: GoogleUser } | null> {
  const google = await signInWithGoogle();
  if (!google) return null;
  onAuthenticated?.();
  const res = await call<SessionResult>('authGoogle', { idToken: google.idToken });
  if (res.error) return { member: null, error: res.error as LoginError, google };
  return { member: await openSession(res), google };
}

/** 구글 계정으로 새 회원 생성 + 세션 시작 */
export async function registerWithGoogle(google: GoogleUser): Promise<Member> {
  const member = await openSession(await call<SessionResult>('authRegisterGoogle', {
    idToken: google.idToken, displayName: google.displayName,
  }));
  if (!member) throw new Error('register failed');
  return member;
}

/** 로그인한 회원 계정에 구글 연결 */
export async function linkGoogleToMember(google: GoogleUser): Promise<{ ok: boolean; email: string; error?: string }> {
  const res = await call<{ ok: boolean; email?: string; error?: string }>('linkGoogle', { idToken: google.idToken });
  return { ok: res.ok, email: res.email ?? google.email, error: res.error };
}

/** 구글 팝업 → 로그인한 회원 계정에 연결. 팝업 취소 시 null */
export async function linkGoogleAccount(): Promise<{ ok: boolean; email: string; error?: string } | null> {
  const google = await signInWithGoogle();
  if (!google) return null;
  return linkGoogleToMember(google);
}

export function unlinkGoogleFromMember() {
  return call('unlinkGoogle');
}

// ── 기기·접속 기록 ────────────────────────────────────────────────────────────

export type PushScope = 'user' | 'admin';

/**
 * 현재 기기 FCM 토큰을 로그인한 회원 문서에 추가한다 (기존 기기 토큰은 유지).
 * 같은 토큰이 다른 회원에 있으면 서버가 그쪽에서 제거하고, 이 기기의 이전 토큰(prevToken)도 제거한다.
 */
export async function saveFcmToken(token: string, scope: PushScope = 'user', prevToken?: string | null) {
  await call('registerFcmToken', { token, scope, prevToken: prevToken ?? null });
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

export interface InviteInfo {
  status: 'ok' | 'used' | 'notfound';
  personId?: string; personName?: string; familyId?: string; senderName?: string | null;
}

/** 초대 링크 확인 (비로그인 가능) */
export function getInvite(token: string): Promise<InviteInfo> {
  return call('getInvite', { token });
}

/** 초대 수락 — 로그인한 회원을 초대 인물에 연결하고 세션 갱신. 다른 계정이 이미 연결돼 있으면 ALREADY_MAPPED */
export async function acceptInvite(token: string): Promise<Member> {
  const res = await call<SessionResult>('acceptInvite', { token });
  if (res.error === 'already-mapped') throw new Error('ALREADY_MAPPED');
  const member = await openSession(res);
  if (!member) throw new Error(res.error ?? 'failed');
  return member;
}

/** 가족 안에서 이미 계정과 연결된 인물 id 목록 */
export async function getMappedPersonIds(familyId: string): Promise<Set<string>> {
  const snap = await findDocs('members', where('family_id', '==', familyId));
  return new Set(snap.docs.map(d => d.data().person_id as string | null).filter((id): id is string => !!id));
}

export async function isPersonMapped(personId: string, familyId: string): Promise<boolean> {
  const snap = await findDocs('members', where('family_id', '==', familyId), where('person_id', '==', personId));
  return !snap.empty;
}

export async function isFamilyDisabled(familyId: string): Promise<boolean> {
  const snap = await findDocs('persons',
    where('family_id', '==', familyId),
    where('is_root', '==', 1));
  return !snap.empty && !!snap.docs[0].data().family_disabled;
}
