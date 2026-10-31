/** 로그인 세션(localStorage/sessionStorage) 읽기·쓰기 */
import { LS, SS } from './storageKeys';

export const getMemberId   = () => localStorage.getItem(LS.MEMBER_ID);
export const getUserName   = () => localStorage.getItem(LS.USER_NAME);
export const getMyPersonId = () => localStorage.getItem(LS.MY_PERSON_ID);

export const isAdminSession  = () => localStorage.getItem(LS.IS_ADMIN) === 'true';
export const isAdminReturn   = () => localStorage.getItem(LS.ADMIN_RETURN) === 'true';
/** 관리자 본인 또는 관리자 대리 접속 중 */
export const isAdminContext  = () => isAdminSession() || isAdminReturn();

export function startAdminSession(username: string, memberId: string) {
  localStorage.setItem(LS.IS_ADMIN,  'true');
  localStorage.setItem(LS.USER_NAME, username);
  localStorage.setItem(LS.MEMBER_ID, memberId);
}

interface FamilySession {
  userName: string;
  familyId: string;
  personId: string;
  /** null이면 MEMBER_ID를 지운다 (관리자 "가족 보기") */
  memberId: string | null;
  accountName?: string;
}

/** 가족·인물이 매핑된 계정으로 가계도 세션 시작 */
export function startFamilySession({ userName, familyId, personId, memberId, accountName }: FamilySession) {
  localStorage.setItem(LS.USER_NAME,    userName);
  localStorage.setItem(LS.FAMILY_ID,    familyId);
  localStorage.setItem(LS.MY_PERSON_ID, personId);
  if (memberId) localStorage.setItem(LS.MEMBER_ID, memberId);
  else          localStorage.removeItem(LS.MEMBER_ID);
  if (accountName) localStorage.setItem(LS.ACCOUNT_NAME, accountName);
  sessionStorage.setItem(SS.VIEWPOINT_PERSON_ID, personId);
}

/** 관리자가 특정 가족/계정으로 대리 접속 */
export function startImpersonation(session: FamilySession) {
  localStorage.removeItem(LS.IS_ADMIN);
  localStorage.setItem(LS.ADMIN_RETURN, 'true');
  // 일반 회원 사용 중엔 갱신되지 않던 값 — 남아 있으면 대리 접속 직후 유휴 로그아웃됨
  localStorage.setItem(LS.LAST_ACTIVITY, String(Date.now()));
  startFamilySession(session);
}

/** 대리 접속 종료 → 관리자 화면으로 복귀 */
export function returnToAdmin() {
  localStorage.removeItem(LS.USER_NAME);
  localStorage.removeItem(LS.FAMILY_ID);
  localStorage.removeItem(LS.ADMIN_RETURN);
  localStorage.setItem(LS.IS_ADMIN, 'true');
}

/** 계정 식별 정보만 제거 (가입 직후 새로 로그인하도록) */
export function clearUserIdentity() {
  localStorage.removeItem(LS.USER_NAME);
  localStorage.removeItem(LS.FAMILY_ID);
  localStorage.removeItem(LS.MEMBER_ID);
  localStorage.removeItem(LS.MY_PERSON_ID);
  localStorage.removeItem(LS.ACCOUNT_NAME);
}

/** 로그아웃 — 세션 관련 키 전부 제거 */
export function clearSession() {
  clearUserIdentity();
  localStorage.removeItem(LS.IS_ADMIN);
  localStorage.removeItem(LS.ADMIN_RETURN);
  localStorage.removeItem(LS.GOOGLE_EMAIL);
  localStorage.removeItem(LS.PENDING_INVITE_TOKEN);
  localStorage.removeItem(LS.LAST_ACTIVITY);
  sessionStorage.removeItem(SS.VIEWPOINT_PERSON_ID);
}

/** 초대 링크로 들어온 컨텍스트 (InvitePage가 저장) */
export function getInviteContext() {
  return {
    token:      sessionStorage.getItem(SS.INVITE_TOKEN),
    personId:   sessionStorage.getItem(SS.INVITE_PERSON_ID),
    personName: sessionStorage.getItem(SS.INVITE_PERSON_NAME),
    familyId:   sessionStorage.getItem(SS.INVITE_FAMILY_ID),
  };
}

export function hasInviteContext(): boolean {
  const { personId, familyId } = getInviteContext();
  return !!(personId && familyId);
}

export function clearInviteContext() {
  sessionStorage.removeItem(SS.INVITE_TOKEN);
  sessionStorage.removeItem(SS.INVITE_PERSON_ID);
  sessionStorage.removeItem(SS.INVITE_PERSON_NAME);
  sessionStorage.removeItem(SS.INVITE_FAMILY_ID);
  localStorage.removeItem(LS.PENDING_INVITE_TOKEN);
}
