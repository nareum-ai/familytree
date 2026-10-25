// 초기 로드 시 1회 실행하는 데이터 보정 (모두 best-effort: 실패해도 무시)
import { addDoc, collection, deleteDoc, doc, getDocs, limit, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { findDocs } from '../lib/firestore';
import { parseKoreanName } from '../utils/nameParser';
import type { Person, Relationship } from '../types';

interface Snapshot {
  persons: Person[];
  relationships: Relationship[];
  familyId: string | null;
}

const ignore = () => {};

// ── 고아 관계 정리: 삭제된 인물을 참조하는 관계 제거 ─────────────────────
// 인물 삭제 중 스냅샷이 부분 상태로 발화되면 race condition으로 잔여 관계가
// 남을 수 있다. 초기 로드 시 한 번 정리한다.
async function fixOrphanedRelationships({ persons, relationships }: Snapshot) {
  const personIds = new Set(persons.map(p => p.id));
  const orphaned = relationships.filter(
    r => !personIds.has(r.person1_id) || !personIds.has(r.person2_id)
  );
  await Promise.all(orphaned.map(r => deleteDoc(doc(db, 'relationships', r.id)).catch(ignore)));
}

// ── 공동자녀 기반 배우자 관계 생성 ──────────────────────────────────────
async function fixMissingSpouseRels({ persons, relationships, familyId }: Snapshot) {
  const childToParents = new Map<string, string[]>();
  for (const r of relationships) {
    if (r.type !== 'parent_child') continue;
    const list = childToParents.get(r.person2_id) ?? [];
    list.push(r.person1_id);
    childToParents.set(r.person2_id, list);
  }
  const existingPairs = new Set<string>();
  for (const r of relationships) {
    if (r.type !== 'spouse') continue;
    existingPairs.add(`${r.person1_id}|${r.person2_id}`);
    existingPairs.add(`${r.person2_id}|${r.person1_id}`);
  }
  for (const parentIds of childToParents.values()) {
    if (parentIds.length < 2) continue;
    const male   = parentIds.find(pid => persons.find(p => p.id === pid)?.gender === 'male') ?? parentIds[0];
    const female = parentIds.find(pid => pid !== male);
    if (!male || !female) continue;
    if (existingPairs.has(`${male}|${female}`)) continue;
    try {
      await addDoc(collection(db, 'relationships'), {
        person1_id: male, person2_id: female, type: 'spouse', family_id: familyId,
      });
      existingPairs.add(`${male}|${female}`);
      existingPairs.add(`${female}|${male}`);
    } catch { /* best-effort */ }
  }
}

// ── 배우자 관계에서 누락된 부모-자녀 관계 보정 ──────────────────────────
async function fixMissingParentChildFromSpouse({ relationships, familyId }: Snapshot) {
  const existing = new Set(
    relationships.map(r => `${r.person1_id}|${r.person2_id}|${r.type}`)
  );
  for (const spouse of relationships) {
    if (spouse.type !== 'spouse') continue;
    const [a, b] = [spouse.person1_id, spouse.person2_id];
    for (const r of relationships) {
      if (r.type !== 'parent_child') continue;
      const otherParent = r.person1_id === a ? b : r.person1_id === b ? a : null;
      if (!otherParent) continue;
      const key = `${otherParent}|${r.person2_id}|parent_child`;
      if (existing.has(key)) continue;
      try {
        await addDoc(collection(db, 'relationships'), {
          person1_id: otherParent, person2_id: r.person2_id, type: 'parent_child', family_id: familyId,
        });
        existing.add(key);
      } catch { /* best-effort */ }
    }
  }
}

// ── is_primary 복구: 배우자가 있는데 대표 배우자가 없는 경우 ──────────────
async function fixPrimarySpouse({ persons, relationships }: Snapshot) {
  const personIds = new Set(persons.map(p => p.id));
  for (const person of persons) {
    const spouseRels = relationships.filter(r =>
      r.type === 'spouse' &&
      (r.person1_id === person.id || r.person2_id === person.id) &&
      personIds.has(r.person1_id) && personIds.has(r.person2_id)
    );
    if (spouseRels.length === 0 || spouseRels.some(r => r.is_primary === true)) continue;
    // 첫 번째 배우자를 대표로 지정
    await updateDoc(doc(db, 'relationships', spouseRels[0].id), { is_primary: true }).catch(ignore);
    break; // 반대쪽도 같은 rel을 보기 때문에 중복 업데이트 방지 (1회 로드당 1건)
  }
}

// ── 성/이름 필드가 없는 기존 인물에 자동 파싱 후 저장 ─────────────────────
async function fixMissingNameParts({ persons }: Snapshot) {
  for (const p of persons) {
    if (p.last_name || p.first_name) continue;
    const { lastName, firstName } = parseKoreanName(p.name);
    await updateDoc(doc(db, 'persons', p.id), { last_name: lastName, first_name: firstName }).catch(ignore);
  }
}

/** 각 단계가 직전 단계의 Firestore 반영 결과(스냅샷 리스너로 갱신된 상태)를 보도록 순차 실행 */
export async function runDataRepairs(getSnapshot: () => Snapshot) {
  for (const fix of [
    fixOrphanedRelationships,
    fixMissingSpouseRels,
    fixMissingParentChildFromSpouse,
    fixPrimarySpouse,
    fixMissingNameParts,
  ]) {
    await fix(getSnapshot());
  }
}

/** family_id 없는 옛 문서를 현재 가족으로 이관 — 해당 가족 문서가 하나도 없을 때만 실행 */
export async function migrateLegacyFamilyId(familyId: string) {
  // 존재 여부만 확인 — 전체 목록을 받지 않도록 1건만 조회
  const checkSnap = await findDocs('persons', where('family_id', '==', familyId), limit(1));
  if (checkSnap.size > 0) return;
  const [allPersons, allRels] = await Promise.all([
    getDocs(collection(db, 'persons')),
    getDocs(collection(db, 'relationships')),
  ]);
  for (const d of [...allPersons.docs, ...allRels.docs]) {
    if (!d.data().family_id) await updateDoc(d.ref, { family_id: familyId }).catch(ignore);
  }
}
