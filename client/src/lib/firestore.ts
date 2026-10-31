/** Firestore 공통 헬퍼 — store와 services에서 공유 */
import {
  addDoc, collection, doc, getDoc, getDocs, query, updateDoc, where,
  type DocumentData, type QueryConstraint,
} from 'firebase/firestore';
import { db } from './firebase';

export const nowIso = () => new Date().toISOString();

export function findDocs(collectionName: string, ...constraints: QueryConstraint[]) {
  return getDocs(query(collection(db, collectionName), ...constraints));
}

export async function getMemberData(memberId: string): Promise<DocumentData | undefined> {
  return (await getDoc(doc(db, 'members', memberId))).data();
}

export function updateMember(memberId: string, patch: DocumentData) {
  return updateDoc(doc(db, 'members', memberId), patch);
}

/** 요청자에게 인물 정보 열람권 부여 (이미 있으면 무시). 새로 부여했으면 true */
export async function grantInfoAccess(requesterMemberId: string, personId: string): Promise<boolean> {
  const dup = await findDocs('info_access',
    where('requester_member_id', '==', requesterMemberId),
    where('person_id',           '==', personId));
  if (!dup.empty) return false;
  await addDoc(collection(db, 'info_access'), {
    requester_member_id: requesterMemberId,
    person_id:           personId,
    granted_at:          nowIso(),
  });
  return true;
}

/** 관리자 활동 로그 (실패해도 무시) */
export function logActivity(action: 'add' | 'delete', personName: string, actorName: string, familyId: string) {
  addDoc(collection(db, 'activity_logs'), {
    at: nowIso(), action, person_name: personName, actor_name: actorName, family_id: familyId,
  }).catch(() => {});
}
