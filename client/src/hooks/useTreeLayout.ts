import { useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { Person, Relationship, BranchType } from '../types';

// ─── 브랜치 앵커 4개를 구하고, 각 앵커에서 BFS로 집합을 한 번만 빌드 ─────────────
// classifyBranch는 이 집합을 참조하는 lookup으로만 동작

interface BranchContext {
  rootId: string;
  rootSpouseIds: Set<string>;
  primarySpouseId: string | null;  // 처가/처외가 기준이 되는 대표 배우자
  coupledChildIds: Set<string>;
  sets: Record<BranchType, Set<string>>;
}

function buildBranchContext(
  persons: Person[],
  relationships: Relationship[]
): BranchContext | null {
  const root = persons.find(p => p.is_root === 1);
  if (!root) return null;

  // 기본 맵
  const parentOf = new Map<string, string[]>();
  const spouseOf = new Map<string, string[]>();
  for (const r of relationships) {
    if (r.type === 'parent_child') {
      const list = parentOf.get(r.person2_id) ?? [];
      list.push(r.person1_id);
      parentOf.set(r.person2_id, list);
    }
    if (r.type === 'spouse') {
      const a = spouseOf.get(r.person1_id) ?? [];
      a.push(r.person2_id);
      spouseOf.set(r.person1_id, a);
      const b = spouseOf.get(r.person2_id) ?? [];
      b.push(r.person1_id);
      spouseOf.set(r.person2_id, b);
    }
  }

  const personById = new Map(persons.map(p => [p.id, p]));
  const rootParents = parentOf.get(root.id) ?? [];
  const rootFather = rootParents.find(id => personById.get(id)?.gender === 'male') ?? rootParents[0] ?? null;
  const rootMother = rootParents.find(id => personById.get(id)?.gender === 'female')
    ?? (rootParents.length > 1 ? rootParents[1] : null) ?? null;

  const rootSpouseIds = new Set(spouseOf.get(root.id) ?? []);

  // 대표 배우자(is_primary=true) 기준으로 처가/처외가 계산
  // is_primary가 없으면 첫 번째 배우자를 fallback으로 사용 (기존 데이터 호환)
  const primarySpouseRel = relationships.find(
    r => r.type === 'spouse' && r.is_primary === true &&
    (r.person1_id === root.id || r.person2_id === root.id)
  );
  const primarySpouseId = primarySpouseRel
    ? (primarySpouseRel.person1_id === root.id ? primarySpouseRel.person2_id : primarySpouseRel.person1_id)
    : (spouseOf.get(root.id)?.[0] ?? null);

  let spouseFather: string | null = null;
  let spouseMother: string | null = null;
  if (primarySpouseId) {
    const sp = parentOf.get(primarySpouseId) ?? [];
    spouseFather = sp.find(id => personById.get(id)?.gender === 'male') ?? sp[0] ?? null;
    spouseMother = sp.find(id => personById.get(id)?.gender === 'female')
      ?? (sp.length > 1 ? sp[1] : null) ?? null;
  }
  // 한 쪽만 있으면 그 사람의 배우자에서 나머지 찾기
  if (spouseFather && !spouseMother) {
    const fSpouses = spouseOf.get(spouseFather) ?? [];
    spouseMother = fSpouses.find(id => personById.get(id)?.gender === 'female') ?? null;
  }
  if (spouseMother && !spouseFather) {
    const mSpouses = spouseOf.get(spouseMother) ?? [];
    spouseFather = mSpouses.find(id => personById.get(id)?.gender === 'male') ?? null;
  }

  // root·배우자의 자녀 (모든 4탭 표시 대상)
  const coupledChildIds = new Set<string>();
  for (const r of relationships) {
    if (r.type !== 'parent_child') continue;
    if (r.person1_id === root.id || rootSpouseIds.has(r.person1_id)) {
      coupledChildIds.add(r.person2_id);
    }
  }

  // 각 앵커에서 family-set BFS
  // 차단선: 반대편 앵커를 exclude하여 두 가계가 섞이지 않게 함
  function buildFamilySet(anchor: string, exclude: Set<string>): Set<string> {
    const result = new Set<string>();
    const visited = new Set<string>(exclude);
    const queue = [anchor];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (visited.has(curr)) continue;
      visited.add(curr);
      result.add(curr);
      for (const r of relationships) {
        if (r.type !== 'parent_child') continue;
        if (r.person1_id === curr && !visited.has(r.person2_id)) queue.push(r.person2_id);
        if (r.person2_id === curr && !visited.has(r.person1_id)) queue.push(r.person1_id);
      }
    }
    return result;
  }

  const exclude친가 = new Set([root.id, ...(rootMother ? [rootMother] : [])]);
  const exclude외가 = new Set([root.id, ...(rootFather ? [rootFather] : [])]);
  const exclude처가 = new Set([root.id, ...(spouseMother ? [spouseMother] : [])]);
  const exclude처외가 = new Set([root.id, ...(spouseFather ? [spouseFather] : [])]);

  const sets: Record<BranchType, Set<string>> = {
    '친가':   rootFather   ? buildFamilySet(rootFather,   exclude친가)   : new Set(),
    '외가':   rootMother   ? buildFamilySet(rootMother,   exclude외가)   : new Set(),
    '처가':   spouseFather ? buildFamilySet(spouseFather, exclude처가)   : new Set(),
    '처외가': spouseMother ? buildFamilySet(spouseMother, exclude처외가) : new Set(),
  };

  // 한 쪽 부모만 있으면 두 탭 모두 포함 (처가만 있고 처외가 없으면 처가→처외가도)
  if (spouseFather && !spouseMother) sets['처외가'] = new Set(sets['처가']);
  if (spouseMother && !spouseFather) sets['처가']   = new Set(sets['처외가']);
  if (rootFather   && !rootMother)   sets['외가']   = new Set(sets['친가']);
  if (rootMother   && !rootFather)   sets['친가']   = new Set(sets['외가']);

  return { rootId: root.id, rootSpouseIds, primarySpouseId, coupledChildIds, sets };
}

// 캐시: persons/relationships 레퍼런스가 바뀌면 재계산
let _ctxCache: { p: Person[]; r: Relationship[]; ctx: BranchContext | null } | null = null;
function getBranchContext(persons: Person[], relationships: Relationship[]): BranchContext | null {
  if (_ctxCache && _ctxCache.p === persons && _ctxCache.r === relationships) return _ctxCache.ctx;
  const ctx = buildBranchContext(persons, relationships);
  _ctxCache = { p: persons, r: relationships, ctx };
  return ctx;
}

export function classifyBranch(
  personId: string,
  persons: Person[],
  relationships: Relationship[]
): BranchType[] {
  const ctx = getBranchContext(persons, relationships);
  if (!ctx) return [];

  if (personId === ctx.rootId) return ['친가', '외가', '처가', '처외가'];
  // 대표 배우자만 처가/처외가 포함 — 비대표 배우자는 친가/외가에만 표시
  if (personId === ctx.primarySpouseId) return ['친가', '외가', '처가', '처외가'];
  if (ctx.rootSpouseIds.has(personId)) return ['친가', '외가'];
  if (ctx.coupledChildIds.has(personId)) return ['친가', '외가', '처가', '처외가'];

  const result: BranchType[] = [];
  for (const branch of ['친가', '외가', '처가', '처외가'] as BranchType[]) {
    if (ctx.sets[branch].has(personId)) result.push(branch);
  }
  return result;
}

// ─── Generation (positive = older than root) ──────────────────────────────────
export function getGeneration(personId: string, root: Person, relationships: Relationship[]): number {
  const visited = new Map<string, number>();
  const queue: Array<{ id: string; gen: number }> = [{ id: root.id, gen: 0 }];
  visited.set(root.id, 0);

  while (queue.length > 0) {
    const { id: curr, gen } = queue.shift()!;
    if (curr === personId) return gen;

    for (const r of relationships) {
      if (r.type === 'parent_child') {
        if (r.person2_id === curr && !visited.has(r.person1_id)) {
          visited.set(r.person1_id, gen + 1);
          queue.push({ id: r.person1_id, gen: gen + 1 });
        }
        if (r.person1_id === curr && !visited.has(r.person2_id)) {
          visited.set(r.person2_id, gen - 1);
          queue.push({ id: r.person2_id, gen: gen - 1 });
        }
      }
      if (r.type === 'spouse') {
        if (r.person1_id === curr && !visited.has(r.person2_id)) {
          visited.set(r.person2_id, gen);
          queue.push({ id: r.person2_id, gen });
        }
        if (r.person2_id === curr && !visited.has(r.person1_id)) {
          visited.set(r.person1_id, gen);
          queue.push({ id: r.person1_id, gen });
        }
      }
    }
  }
  return visited.get(personId) ?? 0;
}

// ─── 촌수 ─────────────────────────────────────────────────────────────────────
export function getChusu(
  personId: string,
  root: Person,
  relationships: Relationship[]
): number | null {
  if (personId === root.id) return 0;

  // 같은 자녀를 공유하는 공동부모(co-parent)는 0촌으로 처리 (사실상 배우자)
  const coParentOf = new Map<string, Set<string>>();
  const childParents = new Map<string, string[]>();
  for (const r of relationships) {
    if (r.type !== 'parent_child') continue;
    const list = childParents.get(r.person2_id) ?? [];
    list.push(r.person1_id);
    childParents.set(r.person2_id, list);
  }
  for (const parents of childParents.values()) {
    for (let i = 0; i < parents.length; i++) {
      for (let j = i + 1; j < parents.length; j++) {
        const si = coParentOf.get(parents[i]) ?? new Set();
        si.add(parents[j]);
        coParentOf.set(parents[i], si);
        const sj = coParentOf.get(parents[j]) ?? new Set();
        sj.add(parents[i]);
        coParentOf.set(parents[j], sj);
      }
    }
  }

  const visited = new Map<string, number>();
  const queue: Array<{ id: string; dist: number }> = [{ id: root.id, dist: 0 }];
  visited.set(root.id, 0);

  while (queue.length > 0) {
    const { id: curr, dist } = queue.shift()!;
    if (curr === personId) return dist;

    for (const r of relationships) {
      if (r.type === 'spouse') {
        const next = r.person1_id === curr ? r.person2_id : r.person2_id === curr ? r.person1_id : null;
        if (next && !visited.has(next)) {
          visited.set(next, dist);
          queue.push({ id: next, dist });
        }
      }
      if (r.type === 'parent_child') {
        const parentId = r.person2_id === curr ? r.person1_id : null;
        const childId = r.person1_id === curr ? r.person2_id : null;
        if (parentId && !visited.has(parentId)) {
          visited.set(parentId, dist + 1);
          queue.push({ id: parentId, dist: dist + 1 });
        }
        if (childId && !visited.has(childId)) {
          visited.set(childId, dist + 1);
          queue.push({ id: childId, dist: dist + 1 });
        }
      }
    }
    // 공동부모 탐색 (0촌 증가)
    for (const coParent of coParentOf.get(curr) ?? []) {
      if (!visited.has(coParent)) {
        visited.set(coParent, dist);
        queue.push({ id: coParent, dist });
      }
    }
  }
  return null;
}

// ─── 노드 공개 여부: 작성자 본인 또는 나(ME) 노드만 상세 표시 ─────────────────
// currentUser: 계정 아이디 (LS_ACCOUNT_NAME 또는 LS_USER_KEY 폴백)
export function canSeeFull(
  person: Person,
  currentUser: string | null,
  viewpointPersonId: string | null,
  root: Person | undefined,
  grantedPersonIds?: Set<string>,
  relationships?: Relationship[]
): boolean {
  if (!currentUser) return true;

  // 내 노드 — viewpointPersonId(비루트) 또는 MY_PERSON_ID(루트 포함) 로 판정
  const myPersonId = localStorage.getItem('familyTreeMyPersonId');
  if (person.id === viewpointPersonId) return true;
  if (myPersonId && person.id === myPersonId) return true;

  // created_by가 계정 아이디와 일치
  if (person.created_by && person.created_by === currentUser) return true;
  // created_by 없음 → 내가 루트 소유자
  if (!person.created_by && myPersonId && root && root.id === myPersonId) return true;

  if (grantedPersonIds?.has(person.id)) return true;

  // 나(viewpoint 또는 myPersonId)로부터 2촌 이내는 기본 공개
  const baseId = viewpointPersonId ?? myPersonId;
  if (baseId && relationships) {
    const chusu = getChusu(person.id, { id: baseId } as Person, relationships);
    if (chusu !== null && chusu <= 2) return true;
  }
  return false;
}

// ─── Layout constants ─────────────────────────────────────────────────────────
const PERSON_W = 90;
const COUPLE_W = 128;  // two 64px hexagons side by side, touching
const NODE_H = 110;
const H_GAP = 20;
const V_GAP = 28;

interface LayoutUnit {
  id: string;           // nodeId (personId or 'couple_X_Y')
  kind: 'single' | 'couple';
  persons: Person[];
  gen: number;
  width: number;
}

// ─── Main layout hook ─────────────────────────────────────────────────────────
export function useTreeLayout(
  persons: Person[],
  relationships: Relationship[],
  activeBranch: BranchType,
  viewpointPersonId: string | null = null,
  currentUserName: string | null = null,
  grantedPersonIds?: Set<string>
) {
  return useMemo(() => {
    const root = persons.find(p => p.is_root === 1);
    if (!root) return { nodes: [], edges: [] };

    // 촌수 기준: 뷰포인트가 설정되면 그 사람, 아니면 root
    const chusuBase = (viewpointPersonId ? persons.find(p => p.id === viewpointPersonId) : null) ?? root;

    // ── Step 1: Build GLOBAL group map (1:N, supports polygamy) ─────────────────
    // Must run BEFORE branch filtering so we can pull in spouses that aren't
    // yet in the branch.
    // globalGroup: groupId → [anchorId, spouse1Id, spouse2Id, ...]
    // globalPersonToGroup: personId → groupId
    const globalGroup = new Map<string, string[]>();
    const globalPersonToGroup = new Map<string, string>();

    // 1a. Explicit spouse relationships — primary first so primary spouse is [1]
    const spouseRels = relationships.filter(r => r.type === 'spouse');
    const sortedSpouseRels = [
      ...spouseRels.filter(r => r.is_primary === true),
      ...spouseRels.filter(r => r.is_primary !== true),
    ];
    for (const r of sortedSpouseRels) {
      const a = r.person1_id, b = r.person2_id;
      const ga = globalPersonToGroup.get(a);
      const gb = globalPersonToGroup.get(b);
      if (!ga && !gb) {
        globalGroup.set(a, [a, b]);
        globalPersonToGroup.set(a, a);
        globalPersonToGroup.set(b, a);
      } else if (ga && !gb) {
        globalGroup.get(ga)!.push(b);
        globalPersonToGroup.set(b, ga);
      } else if (!ga && gb) {
        globalGroup.get(gb)!.push(a);
        globalPersonToGroup.set(a, gb);
      }
    }

    // 1b. Infer from shared children — 제거됨.
    // fixMissingSpouseRels(familyStore)가 초기화 시 공동부모의 spouse 관계를 자동 생성하므로
    // 여기서 추론하면 실제로 배우자가 아닌 사람(예: 테스트 인물, 부모-자녀가 공동 부모로 오인)이
    // 커플 노드에 끌려들어오는 오작동이 발생한다.

    // ── Step 2: Filter to this branch, then pull in spouses + their children ──────
    const initialPersons = persons.filter(p =>
      classifyBranch(p.id, persons, relationships).includes(activeBranch)
    );
    const branchIdSet = new Set(initialPersons.map(p => p.id));

    // Pass A: 그룹 멤버 전원 추가 (다처/다부제 포함, 부부는 한몸)
    const addedCouplePairs: Array<{ original: string; added: string }> = [];
    for (const p of initialPersons) {
      const gid = globalPersonToGroup.get(p.id);
      if (!gid) continue;
      for (const memberId of globalGroup.get(gid) ?? []) {
        if (memberId !== p.id && !branchIdSet.has(memberId)) {
          const member = persons.find(pp => pp.id === memberId);
          if (member) {
            branchIdSet.add(memberId);
            addedCouplePairs.push({ original: p.id, added: memberId });
          }
        }
      }
    }

    // Pass B: 커플의 공동 자녀 추가
    // 핵심 원칙: 부부 A+B의 자녀는 A의 parent_child 자녀 ∪ B의 parent_child 자녀
    // DB에 어느 쪽 엣지만 있어도 공동 자녀로 인정한다.
    // (예: parent_child(홍병한, 홍옥진)만 있어도, 홍병한+김계순 커플의 자녀이므로 외가에 포함)
    for (const { original, added } of addedCouplePairs) {
      const coupleChildIds = new Set<string>();
      for (const r of relationships) {
        if (r.type !== 'parent_child') continue;
        if (r.person1_id === original || r.person1_id === added) {
          coupleChildIds.add(r.person2_id);
        }
      }
      for (const childId of coupleChildIds) {
        if (!branchIdSet.has(childId)) {
          const child = persons.find(pp => pp.id === childId);
          if (child) branchIdSet.add(childId);
        }
      }
    }

    // 뷰포인트가 설정된 경우, 내 배우자의 다른 배우자(공동 배우자)를 숨김
    // 예) 전현숙으로 로그인 시 홍재억의 다른 배우자 전현숙2·전현숙3은 표시하지 않음
    if (viewpointPersonId) {
      const vpSpouseIds = relationships
        .filter(r => r.type === 'spouse' && (r.person1_id === viewpointPersonId || r.person2_id === viewpointPersonId))
        .map(r => r.person1_id === viewpointPersonId ? r.person2_id : r.person1_id);
      for (const mySpouseId of vpSpouseIds) {
        relationships
          .filter(r => r.type === 'spouse' && (r.person1_id === mySpouseId || r.person2_id === mySpouseId))
          .map(r => r.person1_id === mySpouseId ? r.person2_id : r.person1_id)
          .filter(id => id !== viewpointPersonId)
          .forEach(coSpouseId => branchIdSet.delete(coSpouseId));
      }
    }

    const branchPersons = persons.filter(p => branchIdSet.has(p.id));
    const branchIds = branchIdSet;
    const branchRels = relationships.filter(
      r => branchIds.has(r.person1_id) && branchIds.has(r.person2_id)
    );

    // ── Step 3: Branch-level group map ───────────────────────────────────────
    const branchGroupMembers = new Map<string, string[]>(); // groupId → personIds in branch
    const branchPersonToGroup = new Map<string, string>();  // personId → groupId
    for (const [gid, members] of globalGroup) {
      const inBranch = members.filter(id => branchIds.has(id));
      if (inBranch.length >= 2) {
        branchGroupMembers.set(gid, inBranch);
        inBranch.forEach(id => branchPersonToGroup.set(id, gid));
      }
    }

    // Build layout units
    const units: LayoutUnit[] = [];
    const personToUnitId = new Map<string, string>();
    const processed = new Set<string>();

    for (const p of branchPersons) {
      if (processed.has(p.id)) continue;
      const gid = branchPersonToGroup.get(p.id);
      if (gid) {
        const memberIds = branchGroupMembers.get(gid)!;
        const members = memberIds.map(id => branchPersons.find(q => q.id === id)!).filter(Boolean);
        // 앵커(root 또는 남성)를 첫 번째로, 나머지 배우자들을 순서대로
        const anchorIdx = members.findIndex(m => m.is_root === 1 || m.gender === 'male');
        const ordered = anchorIdx >= 0
          ? [members[anchorIdx], ...members.filter((_, i) => i !== anchorIdx)]
          : members;
        const unitId = `couple_${ordered.map(m => m.id).join('_')}`;
        units.push({
          id: unitId,
          kind: 'couple',
          persons: ordered,
          gen: getGeneration(ordered[0].id, root, relationships),
          width: ordered.length * 64,
        });
        ordered.forEach(m => { personToUnitId.set(m.id, unitId); processed.add(m.id); });
      } else {
        units.push({
          id: p.id,
          kind: 'single',
          persons: [p],
          gen: getGeneration(p.id, root, relationships),
          width: PERSON_W,
        });
        personToUnitId.set(p.id, p.id);
        processed.add(p.id);
      }
    }

    // ─── 세대 범위 제한 (나 기준) ─────────────────────────────────────────────
    const GEN_SHOW_UP   = 4; // 나 기준 위로 최대 표시 세대 (조부모 2세대 포함)
    const GEN_SHOW_DOWN = 3; // 나 기준 아래로 최대 표시 세대

    const mePersonId2 = viewpointPersonId ?? root.id;
    const meGen = getGeneration(mePersonId2, root, relationships);
    const genMin = meGen - GEN_SHOW_DOWN; // 후손 방향 (음수)
    const genMax = meGen + GEN_SHOW_UP;   // 조상 방향 (양수)

    // ─── 하위 트리 폭 기반 레이아웃 ──────────────────────────────────────────────
    const birthSortKey = (u: LayoutUnit): number => {
      for (const p of u.persons) {
        if (p.birth_date) return new Date(p.birth_date).getTime();
        if (p.birth_year) return new Date(p.birth_year, 6, 1).getTime();
      }
      return Infinity;
    };

    // 유닛 ID 빠른 접근용 맵 & 세대 맵
    const unitMap = new Map(units.map(u => [u.id, u]));
    const unitGenMap = new Map(units.map(u => [u.id, getGeneration(u.persons[0].id, root, relationships)]));

    // 전체 unitChildren (필터 전)
    const allUnitChildren = new Map<string, string[]>();
    const allUnitHasParent = new Set<string>();
    const seenEdge = new Set<string>();
    for (const r of branchRels) {
      if (r.type !== 'parent_child') continue;
      const pUid = personToUnitId.get(r.person1_id);
      const cUid = personToUnitId.get(r.person2_id);
      if (!pUid || !cUid || pUid === cUid) continue;
      const key = `${pUid}->${cUid}`;
      if (seenEdge.has(key)) continue;
      seenEdge.add(key);
      const list = allUnitChildren.get(pUid) ?? [];
      list.push(cUid);
      allUnitChildren.set(pUid, list);
      allUnitHasParent.add(cUid);
    }

    // 세대 범위로 가시 유닛 필터링
    const visibleUnitSet = new Set(
      units.filter(u => {
        const g = unitGenMap.get(u.id) ?? 0;
        return g >= genMin && g <= genMax;
      }).map(u => u.id)
    );

    // 가시 범위 unitChildren (범위 밖 자녀 제외)
    const unitChildren = new Map<string, string[]>();
    const unitHasParent = new Set<string>();
    const hiddenDescendantsMap = new Map<string, number>(); // 범위 밖 후손 수

    for (const uid of visibleUnitSet) {
      const allKids = allUnitChildren.get(uid) ?? [];
      const visKids    = allKids.filter(k => visibleUnitSet.has(k));
      const hiddenKids = allKids.filter(k => !visibleUnitSet.has(k));

      if (visKids.length > 0) {
        unitChildren.set(uid, visKids);
        visKids.forEach(k => unitHasParent.add(k));
      }

      if (hiddenKids.length > 0) {
        // 숨겨진 후손 수 재귀 계산
        let count = 0;
        const countSub = (id: string, visited: Set<string>) => {
          if (visited.has(id)) return;
          visited.add(id);
          const u = unitMap.get(id);
          if (u) count += u.persons.length;
          (allUnitChildren.get(id) ?? []).forEach(kid => countSub(kid, visited));
        };
        hiddenKids.forEach(hk => countSub(hk, new Set()));
        hiddenDescendantsMap.set(uid, count);
      }
    }

    // 자식들을 생년월일 순 정렬
    for (const kids of unitChildren.values()) {
      kids.sort((a, b) => birthSortKey(unitMap.get(a)!) - birthSortKey(unitMap.get(b)!));
    }

    const filteredUnits = units.filter(u => visibleUnitSet.has(u.id));

    // 하위 트리 전체 폭 (메모이제이션)
    const swCache = new Map<string, number>();
    function sw(uid: string): number {
      if (swCache.has(uid)) return swCache.get(uid)!;
      const unit = unitMap.get(uid)!;
      const kids = unitChildren.get(uid) ?? [];
      let w: number;
      if (kids.length === 0) {
        w = unit.width;
      } else {
        const kw = kids.reduce((s, k, i) => s + sw(k) + (i > 0 ? H_GAP : 0), 0);
        w = Math.max(unit.width, kw);
      }
      swCache.set(uid, w);
      return w;
    }

    // 재귀 배치: 각 유닛을 하위 트리 중앙에 위치
    const positions = new Map<string, { x: number; y: number }>();
    const posVisited = new Set<string>();
    function positionSubtree(uid: string, left: number, depth: number) {
      if (posVisited.has(uid)) return;
      posVisited.add(uid);
      const unit = unitMap.get(uid)!;
      const stw = sw(uid);
      const kids = unitChildren.get(uid) ?? [];
      positions.set(uid, {
        x: left + (stw - unit.width) / 2,
        y: depth * (NODE_H + V_GAP),
      });
      let childLeft = left;
      for (const kid of kids) {
        positionSubtree(kid, childLeft, depth + 1);
        childLeft += sw(kid) + H_GAP;
      }
    }

    // 루트 유닛(가시 범위 내, 부모 없는 것들)부터 배치
    const rootUnits = filteredUnits
      .filter(u => !unitHasParent.has(u.id))
      .sort((a, b) => birthSortKey(a) - birthSortKey(b));

    const totalRootW = rootUnits.reduce((s, u, i) => s + sw(u.id) + (i > 0 ? H_GAP : 0), 0);
    let rootLeft = -totalRootW / 2;
    for (const u of rootUnits) {
      positionSubtree(u.id, rootLeft, 0);
      rootLeft += sw(u.id) + H_GAP;
    }
    for (const u of filteredUnits) {
      if (!positions.has(u.id)) positions.set(u.id, { x: 0, y: 0 });
    }

    // Build react-flow nodes (filteredUnits 기준)
    const nodes: Node[] = filteredUnits.map(u => {
      const pos = positions.get(u.id) || { x: 0, y: 0 };
      const hiddenDesc = hiddenDescendantsMap.get(u.id) ?? 0;
      if (u.kind === 'couple') {
        return {
          id: u.id,
          type: 'coupleNode',
          position: pos,
          width: u.width,
          height: NODE_H,
          data: {
            persons: u.persons,
            chusus: u.persons.map(p => getChusu(p.id, chusuBase, relationships)),
            hiddenDescendants: hiddenDesc,
            anons: u.persons.map(p => !canSeeFull(p, currentUserName, viewpointPersonId, root, grantedPersonIds, relationships)),
          },
        };
      }
      const p = u.persons[0];
      return {
        id: u.id,
        type: 'personNode',
        position: pos,
        width: PERSON_W,
        height: NODE_H,
        data: {
          person: p,
          chusu: getChusu(p.id, chusuBase, relationships),
          isRoot: p.is_root === 1,
          hiddenDescendants: hiddenDesc,
          anon: !canSeeFull(p, currentUserName, viewpointPersonId, root, grantedPersonIds, relationships),
        },
      };
    });

    // Build person-index map for handle targeting (filteredUnits only)
    const personIndexInUnit = new Map<string, number>();
    for (const u of filteredUnits) {
      u.persons.forEach((p, i) => personIndexInUnit.set(p.id, i));
    }

    // Build edges: parent_child only, routed through unit IDs
    const edges: Edge[] = [];
    const addedEdgeKeys = new Set<string>();

    for (const r of branchRels) {
      if (r.type !== 'parent_child') continue;
      const srcId = personToUnitId.get(r.person1_id);
      const tgtId = personToUnitId.get(r.person2_id);
      if (!srcId || !tgtId || srcId === tgtId) continue;
      const key = `${srcId}->${tgtId}`;
      if (addedEdgeKeys.has(key)) continue;
      addedEdgeKeys.add(key);

      // If target is a couple node, route to the specific person's side handle
      const tgtUnit = units.find(u => u.id === tgtId);
      const targetHandle = tgtUnit?.kind === 'couple'
        ? `p${personIndexInUnit.get(r.person2_id) ?? 0}`
        : undefined;

      edges.push({
        id: key,
        source: srcId,
        target: tgtId,
        targetHandle,
        type: 'familyEdge',
        style: { stroke: '#2AABE2', strokeWidth: 2 },
      });
    }

    return { nodes, edges };
  }, [persons, relationships, activeBranch, viewpointPersonId, currentUserName, grantedPersonIds]);
}
