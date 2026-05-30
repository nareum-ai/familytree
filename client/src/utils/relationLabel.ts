import type { Person, Relationship } from '../types';
import { getGeneration } from '../hooks/useTreeLayout';

type Gender = 'male' | 'female' | null;

/** 나(base) 기준으로 target의 한국어 관계명 반환 */
export function getRelationLabel(
  targetId: string,
  base: Person,
  persons: Person[],
  rels: Relationship[]
): string {
  if (targetId === base.id) return '나';

  const target = persons.find(p => p.id === targetId);
  if (!target) return '';

  const t: Gender  = target.gender;
  const me: Gender = base.gender;

  // ── 배우자 ─────────────────────────────────────────────────────────
  const isSpouse = rels.some(r =>
    r.type === 'spouse' && (
      (r.person1_id === base.id && r.person2_id === targetId) ||
      (r.person2_id === base.id && r.person1_id === targetId)
    )
  );
  if (isSpouse) return me === 'female' ? '남편' : '아내';

  const gen = getGeneration(targetId, base, rels);

  // ── 직계 판단 헬퍼 ──────────────────────────────────────────────────
  const goUp = (from: string, to: string): boolean => {
    const q = [from]; const v = new Set<string>();
    while (q.length) {
      const c = q.shift()!;
      if (c === to) return true;
      if (v.has(c)) continue; v.add(c);
      rels.filter(r => r.type === 'parent_child' && r.person2_id === c)
          .forEach(r => q.push(r.person1_id));
    }
    return false;
  };
  const goDown = (from: string, to: string): boolean => {
    const q = [from]; const v = new Set<string>();
    while (q.length) {
      const c = q.shift()!;
      if (c === to) return true;
      if (v.has(c)) continue; v.add(c);
      rels.filter(r => r.type === 'parent_child' && r.person1_id === c)
          .forEach(r => q.push(r.person2_id));
    }
    return false;
  };

  const myParentIds = rels
    .filter(r => r.type === 'parent_child' && r.person2_id === base.id)
    .map(r => r.person1_id);
  const targetParentIds = rels
    .filter(r => r.type === 'parent_child' && r.person2_id === targetId)
    .map(r => r.person1_id);

  const sharedParent = myParentIds.some(pid => targetParentIds.includes(pid));

  // ── 직계 조상 ────────────────────────────────────────────────────────
  if (gen > 0 && goUp(base.id, targetId)) {
    if (gen === 1) return t === 'female' ? '어머니' : '아버지';
    if (gen === 2) return t === 'female' ? '할머니' : '할아버지';
    if (gen === 3) return t === 'female' ? '증조할머니' : '증조할아버지';
    if (gen === 4) return t === 'female' ? '고조할머니' : '고조할아버지';
    return `${gen}대 조상`;
  }

  // ── 직계 후손 ────────────────────────────────────────────────────────
  if (gen < 0 && goDown(base.id, targetId)) {
    if (gen === -1) return t === 'female' ? '딸' : '아들';
    if (gen === -2) return t === 'female' ? '손녀' : '손자';
    if (gen === -3) return t === 'female' ? '증손녀' : '증손자';
    return `${-gen}대 후손`;
  }

  // ── 형제자매 (같은 세대, 공통 부모) ───────────────────────────────────
  if (gen === 0 && sharedParent) {
    return t === 'female'
      ? (me === 'male' ? '누나/여동생' : '언니/여동생')
      : (me === 'male' ? '형/남동생' : '오빠/남동생');
  }

  // ── 부모의 형제자매 (3촌: 삼촌/고모/이모/외삼촌) ───────────────────────
  if (gen === 1) {
    for (const parentId of myParentIds) {
      const parentOfParent = rels
        .filter(r => r.type === 'parent_child' && r.person2_id === parentId)
        .map(r => r.person1_id);
      const targetIsParentSibling = parentOfParent.some(gp =>
        rels.some(r => r.type === 'parent_child' && r.person1_id === gp && r.person2_id === targetId)
      );
      if (targetIsParentSibling) {
        const parentGender = persons.find(p => p.id === parentId)?.gender;
        if (parentGender === 'male') return t === 'female' ? '고모' : '삼촌';
        else return t === 'female' ? '이모' : '외삼촌';
      }
    }
  }

  // ── 조카 (형제자매의 자녀, 3촌) ──────────────────────────────────────
  if (gen === -1) {
    for (const tpId of targetParentIds) {
      const tpParents = rels
        .filter(r => r.type === 'parent_child' && r.person2_id === tpId)
        .map(r => r.person1_id);
      const tpIsSibling = tpParents.some(gp =>
        rels.some(r => r.type === 'parent_child' && r.person1_id === gp && r.person2_id === base.id)
      );
      if (tpIsSibling) return t === 'female' ? '조카딸' : '조카';
    }
  }

  // ── 배우자 부모 (장인/장모/시아버지/시어머니) ────────────────────────
  if (gen === 1) {
    const mySpouseIds = rels
      .filter(r => r.type === 'spouse' && (r.person1_id === base.id || r.person2_id === base.id))
      .map(r => r.person1_id === base.id ? r.person2_id : r.person1_id);
    for (const sid of mySpouseIds) {
      if (goUp(sid, targetId) && getGeneration(targetId, persons.find(p => p.id === sid)!, rels) === 1) {
        return me === 'female'
          ? (t === 'female' ? '시어머니' : '시아버지')
          : (t === 'female' ? '장모' : '장인');
      }
    }
  }

  // ── 사촌 (4촌) ────────────────────────────────────────────────────────
  if (gen === 0 && !sharedParent) {
    // 조부모를 공유하는지 확인
    const myGrandparentIds = myParentIds.flatMap(pid =>
      rels.filter(r => r.type === 'parent_child' && r.person2_id === pid).map(r => r.person1_id)
    );
    const targetGrandparentIds = targetParentIds.flatMap(pid =>
      rels.filter(r => r.type === 'parent_child' && r.person2_id === pid).map(r => r.person1_id)
    );
    if (myGrandparentIds.some(gp => targetGrandparentIds.includes(gp))) {
      return t === 'female' ? '여사촌' : '사촌';
    }
  }

  // ── 세대 방향 힌트 폴백 ───────────────────────────────────────────────
  if (gen > 0) return `${gen}세대 위`;
  if (gen < 0) return `${-gen}세대 아래`;
  return '동년배';
}
