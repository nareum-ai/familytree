// 가계도 그래프 순수 함수 모음 — 브랜치 분류, 세대, 촌수, 공개 여부
// React 의존성 없음: store / utils / 컴포넌트 어디서든 사용 가능
import type { Person, Relationship, BranchType } from '../types';
import { LS } from '../lib/storageKeys';

export const ALL_BRANCHES: BranchType[] = ['친가', '외가', '처가', '처외가'];

export function findRoot(persons: Person[]): Person | undefined {
  return persons.find(p => p.is_root === 1);
}

/** 촌수 계산 기준: 뷰포인트가 설정되면 그 사람, 아니면 root */
export function getChusuBase(persons: Person[], viewpointPersonId: string | null): Person | undefined {
  return (viewpointPersonId ? persons.find(p => p.id === viewpointPersonId) : undefined) ?? findRoot(persons);
}

/** personId의 배우자 ID 목록 */
export function getSpouseIds(personId: string, relationships: Relationship[]): string[] {
  return relationships
    .filter(r => r.type === 'spouse' && (r.person1_id === personId || r.person2_id === personId))
    .map(r => r.person1_id === personId ? r.person2_id : r.person1_id);
}

export function hasSpouse(personId: string, relationships: Relationship[]): boolean {
  return relationships.some(
    r => r.type === 'spouse' && (r.person1_id === personId || r.person2_id === personId)
  );
}

/** 뷰포인트 인물이 볼 수 있는 브랜치 — 비루트 뷰포인트가 미혼이면 배우자 쪽 탭 제외 */
export function getAccessibleBranches(
  persons: Person[],
  relationships: Relationship[],
  viewpointPersonId: string | null
): BranchType[] {
  const root = findRoot(persons);
  const viewpoint = viewpointPersonId ? persons.find(p => p.id === viewpointPersonId) : null;
  if (!root || !viewpoint || viewpoint.id === root.id) return ALL_BRANCHES;
  return hasSpouse(viewpoint.id, relationships) ? ALL_BRANCHES : ['친가', '외가'];
}

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
  const root = findRoot(persons);
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

  if (personId === ctx.rootId) return ALL_BRANCHES;
  // 대표 배우자만 처가/처외가 포함 — 비대표 배우자는 친가/외가에만 표시
  if (personId === ctx.primarySpouseId) return ALL_BRANCHES;
  if (ctx.rootSpouseIds.has(personId)) return ['친가', '외가'];
  if (ctx.coupledChildIds.has(personId)) return ALL_BRANCHES;

  return ALL_BRANCHES.filter(branch => ctx.sets[branch].has(personId));
}

// ─── BFS 결과 캐시 ────────────────────────────────────────────────────────────
// getGeneration/getChusu는 인물마다 반복 호출되므로, 기준 인물별 BFS를 한 번만 돌려
// 전체 거리 맵을 relationships 레퍼런스 기준으로 캐시한다.
function memoByBase<T>(compute: (baseId: string, relationships: Relationship[]) => Map<string, T>) {
  const cache = new WeakMap<Relationship[], Map<string, Map<string, T>>>();
  return (baseId: string, relationships: Relationship[]): Map<string, T> => {
    let byBase = cache.get(relationships);
    if (!byBase) { byBase = new Map(); cache.set(relationships, byBase); }
    let result = byBase.get(baseId);
    if (!result) { result = compute(baseId, relationships); byBase.set(baseId, result); }
    return result;
  };
}

// ─── Generation (positive = older than root) ──────────────────────────────────
const generationMap = memoByBase<number>((rootId, relationships) => {
  const visited = new Map<string, number>([[rootId, 0]]);
  const queue: Array<{ id: string; gen: number }> = [{ id: rootId, gen: 0 }];
  const visit = (id: string, gen: number) => {
    if (visited.has(id)) return;
    visited.set(id, gen);
    queue.push({ id, gen });
  };

  while (queue.length > 0) {
    const { id: curr, gen } = queue.shift()!;
    for (const r of relationships) {
      if (r.type === 'parent_child') {
        if (r.person2_id === curr) visit(r.person1_id, gen + 1);
        if (r.person1_id === curr) visit(r.person2_id, gen - 1);
      }
      if (r.type === 'spouse') {
        if (r.person1_id === curr) visit(r.person2_id, gen);
        if (r.person2_id === curr) visit(r.person1_id, gen);
      }
    }
  }
  return visited;
});

export function getGeneration(personId: string, root: Person, relationships: Relationship[]): number {
  return generationMap(root.id, relationships).get(personId) ?? 0;
}

// 같은 자녀를 공유하는 공동부모(co-parent) 맵: relationships 레퍼런스 기준 캐시
const coParentCache = new WeakMap<Relationship[], Map<string, Set<string>>>();
function getCoParentOf(relationships: Relationship[]): Map<string, Set<string>> {
  const cached = coParentCache.get(relationships);
  if (cached) return cached;

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
  coParentCache.set(relationships, coParentOf);
  return coParentOf;
}

// ─── 촌수 ─────────────────────────────────────────────────────────────────────
const chusuMap = memoByBase<number>((baseId, relationships) => {
  // 같은 자녀를 공유하는 공동부모(co-parent)는 0촌으로 처리 (사실상 배우자)
  const coParentOf = getCoParentOf(relationships);

  const visited = new Map<string, number>([[baseId, 0]]);
  const queue: Array<{ id: string; dist: number }> = [{ id: baseId, dist: 0 }];
  const visit = (id: string, dist: number) => {
    if (visited.has(id)) return;
    visited.set(id, dist);
    queue.push({ id, dist });
  };

  while (queue.length > 0) {
    const { id: curr, dist } = queue.shift()!;
    for (const r of relationships) {
      if (r.type === 'spouse') {
        if (r.person1_id === curr) visit(r.person2_id, dist);
        else if (r.person2_id === curr) visit(r.person1_id, dist);
      }
      if (r.type === 'parent_child') {
        if (r.person2_id === curr) visit(r.person1_id, dist + 1);
        if (r.person1_id === curr) visit(r.person2_id, dist + 1);
      }
    }
    // 공동부모 탐색 (0촌 증가)
    for (const coParent of coParentOf.get(curr) ?? []) visit(coParent, dist);
  }
  return visited;
});

/** 직계 가족: 본인 + 배우자 + 직계존속(부모·조부모…) + 직계비속(자녀·손주…) */
export function getLinealFamilyIds(baseId: string, relationships: Relationship[]): Set<string> {
  const result = new Set<string>([baseId, ...getSpouseIds(baseId, relationships)]);
  const walk = (start: string, dir: 'up' | 'down') => {
    const queue = [start];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const r of relationships) {
        if (r.type !== 'parent_child') continue;
        const next = dir === 'up'
          ? (r.person2_id === curr ? r.person1_id : null)
          : (r.person1_id === curr ? r.person2_id : null);
        if (next && !result.has(next)) {
          result.add(next);
          queue.push(next);
        }
      }
    }
  };
  walk(baseId, 'up');
  walk(baseId, 'down');
  return result;
}

export function getChusu(
  personId: string,
  base: Pick<Person, 'id'>,
  relationships: Relationship[]
): number | null {
  if (personId === base.id) return 0;
  return chusuMap(base.id, relationships).get(personId) ?? null;
}

// ─── 노드 공개 여부: 작성자 본인 또는 나(ME) 노드만 상세 표시 ─────────────────
// currentUser: 계정 아이디 (getCurrentUserName)
export function canSeeFull(
  person: Person,
  currentUser: string | null,
  viewpointPersonId: string | null,
  root: Person | undefined,
  grantedPersonIds?: Set<string>,
  relationships?: Relationship[],
  tempUnlockAll?: boolean
): boolean {
  if (!currentUser) return true;
  if (tempUnlockAll) return true;

  // 내 노드 — viewpointPersonId(비루트) 또는 MY_PERSON_ID(루트 포함) 로 판정
  const myPersonId = localStorage.getItem(LS.MY_PERSON_ID);
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
    const chusu = getChusu(person.id, { id: baseId }, relationships);
    if (chusu !== null && chusu <= 2) return true;
  }
  return false;
}

// ─── 삭제 시 고립되는 인물 ───────────────────────────────────────────────────
// person을 삭제하면 root와 연결이 끊기는 직계 연결 인물 ID 목록
export function findOrphansOnDelete(
  person: Person,
  persons: Person[],
  relationships: Relationship[],
  spouseId: string | null
): string[] {
  const root = findRoot(persons);
  if (!root) return [];

  const filteredRels = relationships.filter(
    r => r.person1_id !== person.id && r.person2_id !== person.id
  );
  const canReach = (startId: string): boolean => {
    const visited = new Set<string>();
    const q = [startId];
    while (q.length) {
      const cur = q.shift()!;
      if (cur === root.id) return true;
      if (visited.has(cur)) continue;
      visited.add(cur);
      filteredRels
        .filter(r => r.person1_id === cur || r.person2_id === cur)
        .forEach(r => q.push(r.person1_id === cur ? r.person2_id : r.person1_id));
    }
    return false;
  };

  const neighborIds = new Set(
    relationships
      .filter(r => r.person1_id === person.id || r.person2_id === person.id)
      .map(r => r.person1_id === person.id ? r.person2_id : r.person1_id)
  );
  return [...neighborIds].filter(pid => {
    if (pid === root.id) return false;
    if (canReach(pid)) return false;
    // 배우자가 root에 연결돼 있고, 이 인물이 삭제 대상의 자녀면 고아 아님
    if (spouseId && canReach(spouseId)) {
      const isChild = relationships.some(
        r => r.type === 'parent_child' && r.person1_id === person.id && r.person2_id === pid
      );
      if (isChild) return false;
    }
    return true;
  });
}
