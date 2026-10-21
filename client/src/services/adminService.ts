/** 관리자 전용 Firestore 작업 */
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../lib/firebase';
import { findDocs, nowIso, updateMember } from '../lib/firestore';
import { getMemberId } from '../lib/session';
import { DEFAULT_PERMISSIONS } from '../types/permissions';
import { parseKoreanName } from '../utils/nameParser';
import { createPasswordResetToken } from './authService';
import type { ApprovalRequest, Member, PasswordResetRequest, Person, Relationship } from '../types';

export interface FamilyInfo {
  familyId: string; rootName: string; createdAt: string;
  disabled: boolean; rootPersonId: string; personCount: number;
}

export interface ActivityLog { id: string; at: string; action: 'add' | 'delete'; person_name: string; actor_name: string }
export interface LoginLog { id: string; logged_in_at: string; user_agent: string }
export interface PersonSearchResult { id: string; name: string; familyId: string; deceased: boolean }

function markReviewed(collectionName: string, id: string, status: 'approved' | 'rejected', extra: Record<string, unknown> = {}) {
  return updateDoc(doc(db, collectionName, id), { status, ...extra, reviewed_at: nowIso() });
}

// ── 가족집단 생성 신청 ────────────────────────────────────────────────────────

export async function loadApprovalRequests(): Promise<ApprovalRequest[]> {
  const snap = await findDocs('approval_requests', where('status', '==', 'pending'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as ApprovalRequest[];
}

/** 신청 승인 → 새 가족집단과 루트 인물 생성, 신청 계정을 루트에 매핑. 새 familyId 반환 */
export async function approveRequest(requestId: string, requestedName: string): Promise<string> {
  const familyId = uuidv4();
  const reqData = (await getDoc(doc(db, 'approval_requests', requestId))).data();
  const memberId = (reqData?.member_id as string | undefined) ?? null;
  const parsed = parseKoreanName(requestedName);

  const rootPersonRef = await addDoc(collection(db, 'persons'), {
    name:        requestedName,
    gender:      (reqData?.gender      as string  | undefined) ?? null,
    birth_year:  null,
    birth_date:  (reqData?.birth_date  as string  | undefined) ?? null,
    birth_lunar: (reqData?.birth_lunar as boolean | undefined) ?? false,
    photo_url:   null,
    is_root:     1,
    is_deceased: false, death_date: null, death_lunar: false,
    created_by:  requestedName,
    permissions: DEFAULT_PERMISSIONS,
    family_id:   familyId,
    last_name:   parsed.lastName,
    first_name:  parsed.firstName,
    created_at:  nowIso(),
  });

  await markReviewed('approval_requests', requestId, 'approved', { family_id: familyId });

  if (memberId) {
    await updateMember(memberId, {
      person_id:   rootPersonRef.id,
      family_id:   familyId,
      person_name: requestedName,
    });
  }
  return familyId;
}

export function rejectRequest(requestId: string) {
  return markReviewed('approval_requests', requestId, 'rejected');
}

// ── 비밀번호 초기화 요청 ──────────────────────────────────────────────────────

export async function loadPasswordResetRequests(): Promise<PasswordResetRequest[]> {
  const snap = await findDocs('password_reset_requests', where('status', '==', 'pending'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as PasswordResetRequest[];
}

export async function approvePasswordResetRequest(requestId: string, username: string, contactEmail: string) {
  const memberSnap = await findDocs('members', where('username', '==', username));
  if (memberSnap.empty) throw new Error('member not found');
  await Promise.all([
    createPasswordResetToken(memberSnap.docs[0].id, { contact_email: contactEmail }),
    markReviewed('password_reset_requests', requestId, 'approved'),
  ]);
}

export function rejectPasswordResetRequest(requestId: string) {
  return markReviewed('password_reset_requests', requestId, 'rejected');
}

// ── 회원 ──────────────────────────────────────────────────────────────────────

export async function listMembers(): Promise<Member[]> {
  const snap = await getDocs(collection(db, 'members'));
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Member, 'id'>) }));
}

export function deleteMember(memberId: string) {
  return deleteDoc(doc(db, 'members', memberId));
}

export async function loadLoginLogs(memberId: string): Promise<LoginLog[]> {
  const snap = await findDocs('login_logs',
    where('member_id', '==', memberId),
    orderBy('logged_in_at', 'desc'),
    limit(20));
  return snap.docs.map(d => ({
    id:           d.id,
    logged_in_at: d.data().logged_in_at as string,
    user_agent:   (d.data().user_agent as string) ?? '',
  }));
}

/** 이름·이름(first_name) 전방 일치 검색 (excludeIds 제외) */
export async function searchPersonsByName(q: string, excludeIds: Set<string>): Promise<PersonSearchResult[]> {
  const end = q + '';
  const [byName, byFirst] = await Promise.all([
    findDocs('persons', where('name',       '>=', q), where('name',       '<=', end), limit(30)),
    findDocs('persons', where('first_name', '>=', q), where('first_name', '<=', end), limit(30)),
  ]);
  const seen = new Set<string>();
  const results: PersonSearchResult[] = [];
  for (const d of [...byName.docs, ...byFirst.docs]) {
    if (seen.has(d.id) || excludeIds.has(d.id)) continue;
    seen.add(d.id);
    results.push({
      id:       d.id,
      name:     d.data().name      as string,
      familyId: d.data().family_id as string,
      deceased: !!d.data().is_deceased,
    });
  }
  return results;
}

// ── 가족집단 ──────────────────────────────────────────────────────────────────

export async function listFamilies(): Promise<FamilyInfo[]> {
  const [rootSnap, allSnap] = await Promise.all([
    findDocs('persons', where('is_root', '==', 1)),
    getDocs(collection(db, 'persons')),
  ]);
  const countByFamily = new Map<string, number>();
  for (const d of allSnap.docs) {
    const fid = (d.data().family_id as string) ?? 'main';
    countByFamily.set(fid, (countByFamily.get(fid) ?? 0) + 1);
  }
  const byFamily = new Map<string, FamilyInfo>();
  for (const d of rootSnap.docs) {
    const fid = (d.data().family_id as string) ?? 'main';
    if (byFamily.has(fid)) continue;
    byFamily.set(fid, {
      familyId:     fid,
      rootName:     d.data().name as string,
      createdAt:    d.data().created_at as string,
      disabled:     !!d.data().family_disabled,
      rootPersonId: d.id,
      personCount:  countByFamily.get(fid) ?? 0,
    });
  }
  return [...byFamily.values()];
}

export function toggleFamilyStatus(rootPersonId: string, disabled: boolean) {
  return updateDoc(doc(db, 'persons', rootPersonId), { family_disabled: disabled });
}

async function loadFamilyDocs(familyId: string) {
  return Promise.all([
    findDocs('persons',       where('family_id', '==', familyId)),
    findDocs('relationships', where('family_id', '==', familyId)),
  ]);
}

export async function deleteFamily(familyId: string) {
  const [pSnap, rSnap] = await loadFamilyDocs(familyId);
  await Promise.all([...pSnap.docs, ...rSnap.docs].map(d => deleteDoc(d.ref)));
}

export async function loadFamilyData(familyId: string): Promise<{ persons: Person[]; relationships: Relationship[] }> {
  const [pSnap, rSnap] = await loadFamilyDocs(familyId);
  return {
    persons:       pSnap.docs.map(d => ({ ...(d.data() as Omit<Person, 'id'>), id: d.id })),
    relationships: rSnap.docs.map(d => ({ ...(d.data() as Omit<Relationship, 'id'>), id: d.id })),
  };
}

// ── 알림·로그 ─────────────────────────────────────────────────────────────────

export async function loadPushSendHour(): Promise<number | null> {
  const snap = await getDoc(doc(db, 'settings', 'push'));
  const hour = snap.data()?.sendHourKST;
  return typeof hour === 'number' ? hour : null;
}

export function savePushSendHour(sendHourKST: number) {
  return setDoc(doc(db, 'settings', 'push'), { sendHourKST }, { merge: true });
}

/** 공지 푸시 발송 요청 — 실제 발송은 Cloud Function이 처리. targetMemberId null이면 전체 */
export function sendBroadcastPush(title: string, body: string, targetMemberId: string | null) {
  return addDoc(collection(db, 'push_broadcasts'), {
    title,
    body,
    member_id:        getMemberId(),
    target_member_id: targetMemberId,
    sent:             false,
    created_at:       nowIso(),
  });
}

export async function loadActivityLogs(): Promise<ActivityLog[]> {
  const snap = await findDocs('activity_logs', orderBy('at', 'desc'), limit(100));
  return snap.docs.map(d => ({
    id:          d.id,
    at:          d.data().at          as string,
    action:      d.data().action      as 'add' | 'delete',
    person_name: d.data().person_name as string,
    actor_name:  d.data().actor_name  as string,
  }));
}
