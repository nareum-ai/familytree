// 자동 생성 파일 — 수정은 client/src/utils/relationLabel.ts 에서
import type { Person, Relationship } from './types';
import { getGeneration } from './generation';

type Gender = 'male' | 'female' | null;

function ageCompare(a: Person, b: Person): 1 | -1 | 0 {
  const ay = a.birth_year ?? (a.birth_date ? parseInt(a.birth_date) : 0);
  const by_ = b.birth_year ?? (b.birth_date ? parseInt(b.birth_date) : 0);
  if (ay && by_) {
    if (ay < by_) return 1;
    if (ay > by_) return -1;
    if (a.birth_date && b.birth_date) {
      if (a.birth_date < b.birth_date) return 1;
      if (a.birth_date > b.birth_date) return -1;
    }
  }
  return 0;
}

// ─── 그래프 인덱스 ────────────────────────────────────────────────────────────
interface Graph {
  byId: Map<string, Person>;
  parentsOf: Map<string, string[]>;
  childrenOf: Map<string, string[]>;
  spousesOf: Map<string, string[]>;
}

const graphCache = new WeakMap<Relationship[], WeakMap<Person[], Graph>>();

function getGraph(persons: Person[], rels: Relationship[]): Graph {
  let inner = graphCache.get(rels);
  const cached = inner?.get(persons);
  if (cached) return cached;

  const push = (m: Map<string, string[]>, k: string, v: string) => {
    const arr = m.get(k);
    if (arr) { if (!arr.includes(v)) arr.push(v); } else m.set(k, [v]);
  };
  const g: Graph = {
    byId: new Map(persons.map(p => [p.id, p])),
    parentsOf: new Map(), childrenOf: new Map(), spousesOf: new Map(),
  };
  for (const r of rels) {
    if (r.type === 'parent_child') {
      push(g.parentsOf, r.person2_id, r.person1_id);
      push(g.childrenOf, r.person1_id, r.person2_id);
    } else if (r.type === 'spouse') {
      push(g.spousesOf, r.person1_id, r.person2_id);
      push(g.spousesOf, r.person2_id, r.person1_id);
    }
  }
  if (!inner) { inner = new WeakMap(); graphCache.set(rels, inner); }
  inner.set(persons, g);
  return g;
}

/** id에서 위로 올라가며 각 조상까지의 경로 [id, 부모, 조부모, ..., 조상] */
function ancestorPaths(id: string, g: Graph): Map<string, string[]> {
  const paths = new Map<string, string[]>([[id, [id]]]);
  const queue = [id];
  while (queue.length) {
    const cur = queue.shift()!;
    const path = paths.get(cur)!;
    for (const p of g.parentsOf.get(cur) ?? []) {
      if (paths.has(p)) continue;
      paths.set(p, [...path, p]);
      queue.push(p);
    }
  }
  return paths;
}

// ─── 혈족 관계 ────────────────────────────────────────────────────────────────
interface BloodPath {
  up: number;          // 나 → 공통조상 세대 수
  down: number;        // 공통조상 → 대상 세대 수
  basePath: string[];  // [나, 부모, ..., 공통조상]
  targetPath: string[]; // [대상, 부모, ..., 공통조상]
}

function findBloodPath(baseId: string, targetId: string, g: Graph): BloodPath | null {
  const baseAnc = ancestorPaths(baseId, g);
  const targetAnc = ancestorPaths(targetId, g);
  let best: BloodPath | null = null;
  for (const [anc, basePath] of baseAnc) {
    const targetPath = targetAnc.get(anc);
    if (!targetPath) continue;
    const up = basePath.length - 1, down = targetPath.length - 1;
    if (!best || up + down < best.up + best.down) best = { up, down, basePath, targetPath };
  }
  return best;
}

/** 4촌 경로의 사촌 종류: 아버지 쪽 고모면 고종, 어머니 쪽은 외/이종 */
function cousinPrefix(bp: BloodPath, g: Graph): string {
  const maternal = g.byId.get(bp.basePath[1])?.gender === 'female';
  const uncleIsFemale = g.byId.get(bp.targetPath[1])?.gender === 'female';
  if (maternal) return uncleIsFemale ? '이종사촌' : '외사촌';
  return uncleIsFemale ? '고종사촌' : '사촌';
}

function bloodLabel(bp: BloodPath, base: Person, target: Person, g: Graph): string {
  const { up, down, basePath, targetPath } = bp;
  const t: Gender = target.gender;
  const me: Gender = base.gender;
  const F = t === 'female';
  const gender = (id: string | undefined) => (id ? g.byId.get(id)?.gender ?? null : null);
  // 나의 부모 중 경로상 부모가 어머니면 외가
  const maternal = up >= 2 && gender(basePath[1]) === 'female';
  const oe = maternal ? '외' : '';

  // ── 직계 조상 ──
  if (down === 0) {
    if (up === 1) return F ? '어머니' : '아버지';
    if (up === 2) return `${oe}${F ? '할머니' : '할아버지'}`;
    if (up === 3) return `${oe}증조${F ? '할머니' : '할아버지'}`;
    if (up === 4) return `${oe}고조${F ? '할머니' : '할아버지'}`;
    return `${up}대 조상`;
  }

  // ── 직계 후손 ── (딸 쪽 자손은 외손)
  if (up === 0) {
    const oeSon = down >= 2 && gender(targetPath[down - 1]) === 'female' ? '외' : '';
    if (down === 1) return F ? '딸' : '아들';
    if (down === 2) return `${oeSon}${F ? '손녀' : '손자'}`;
    if (down === 3) return `${oeSon}증${F ? '손녀' : '손자'}`;
    if (down === 4) return `${oeSon}고${F ? '손녀' : '손자'}`;
    return `${down}대 후손`;
  }

  // ── 형제자매 (2촌) ──
  if (up === 1 && down === 1) {
    const cmp = ageCompare(target, base);
    if (cmp < 0) return F ? '여동생' : '남동생';
    // 연상 또는 나이 판별 불가 → 연상으로 폴백
    if (F) return me === 'male' ? '누나' : '언니';
    return me === 'female' ? '오빠' : '형';
  }

  // ── 형제의 후손: 조카(3촌) / 종손(4촌) ──
  if (up === 1) {
    if (down === 2) return F ? '조카딸' : '조카';
    if (down === 3) return F ? '종손녀' : '종손';
  }

  // ── 부모의 형제자매 (3촌) ──
  if (up === 2 && down === 1) {
    const parent = g.byId.get(basePath[1]);
    if (maternal) return F ? '이모' : '외삼촌';
    if (F) return '고모';
    const cmp = parent ? ageCompare(target, parent) : 0;
    if (cmp > 0) return '큰아버지';
    // 아버지보다 어린 남자형제: 기혼이면 작은아버지, 미혼이면 삼촌
    if (cmp < 0) return (g.spousesOf.get(target.id)?.length ?? 0) > 0 ? '작은아버지' : '삼촌';
    return '삼촌';
  }

  // ── 사촌 (4촌) ── 친사촌 / 고종사촌 / 외사촌 / 이종사촌 + 형·누나·오빠·언니·동생
  if (up === 2 && down === 2) {
    const prefix = cousinPrefix(bp, g);
    const cmp = ageCompare(target, base);
    if (cmp < 0) return `${prefix}동생`;
    if (cmp > 0) return prefix + (F ? (me === 'male' ? '누나' : '언니') : (me === 'female' ? '오빠' : '형'));
    return prefix; // 나이 판별 불가 → 손위·손아래를 붙이지 않음
  }

  // ── 5촌 조카: 당질 / 종질 ──
  if (up === 2 && down === 3) {
    if (!maternal && gender(targetPath[2]) === 'male' && gender(targetPath[1]) === 'male') {
      return F ? '당질녀' : '당질';
    }
    return F ? '5촌 조카딸' : '5촌 조카';
  }

  // ── 조부모의 형제자매 (4촌) ──
  if (up === 3 && down === 1) {
    const gp = g.byId.get(basePath[2]);
    if (gp?.gender === 'female') {
      // 할머니의 형제자매
      if (F) return `${oe}이모할머니`;
      return maternal ? '외외종조부' : '진외종조부';
    }
    // 할아버지의 형제자매
    if (F) return `${oe}고모할머니`;
    const cmp = gp ? ageCompare(target, gp) : 0;
    if (cmp < 0) return `${oe}작은할아버지`;
    if (cmp > 0) return `${oe}큰할아버지`;
    return `${oe}종조할아버지`;
  }

  // ── 부모의 사촌 (5촌): 당숙 / 당고모 / 외당숙 / 종이모 ──
  if (up === 3 && down === 2) {
    if (maternal) return F ? '종이모' : '외당숙';
    return F ? '당고모' : '당숙';
  }

  // ── 육촌 / 팔촌 (같은 세대) ──
  if (up === down) {
    if (up === 3) return `${oe}육촌`;
    if (up === 4) return `${oe}팔촌`;
    return `${up + down}촌`;
  }

  // ── 그 밖의 방계: N촌 + 세대 호칭 ──
  const n = up + down;
  const diff = up - down; // 양수면 윗세대
  if (diff === 1)  return `${n}촌 ${F ? '아주머니' : '아저씨'}`;
  if (diff === 2)  return `${n}촌 ${F ? '할머니' : '할아버지'}`;
  if (diff === -1) return `${n}촌 ${F ? '조카딸' : '조카'}`;
  if (diff === -2) return `${n}촌 ${F ? '손녀' : '손자'}`;
  return diff > 0 ? `${diff}세대 위 ${n}촌` : `${-diff}세대 아래 ${n}촌`;
}

// ─── 혈족의 배우자 ────────────────────────────────────────────────────────────
// 혈족 X의 호칭 → X 배우자의 호칭
const SPOUSE_OF: Record<string, string> = {
  '아들': '며느리', '딸': '사위',
  '손자': '손자며느리', '손녀': '손녀사위',
  '외손자': '외손자며느리', '외손녀': '외손녀사위',
  '조카': '조카며느리', '조카딸': '조카사위',
  '당질': '당질부', '당질녀': '당질서',
  '큰아버지': '큰어머니', '작은아버지': '작은어머니', '삼촌': '숙모',
  '고모': '고모부', '이모': '이모부', '외삼촌': '외숙모',
  '큰할아버지': '큰할머니', '작은할아버지': '작은할머니', '종조할아버지': '종조할머니',
  '고모할머니': '고모할아버지', '이모할머니': '이모할아버지',
  '외큰할아버지': '외큰할머니', '외작은할아버지': '외작은할머니',
  '외고모할머니': '외고모할아버지', '외이모할머니': '외이모할아버지',
  '당숙': '당숙모', '당고모': '당고모부', '외당숙': '외당숙모', '종이모': '종이모부',
  '아버지': '새어머니', '어머니': '새아버지',
};

function siblingSpouseLabel(sib: Person, base: Person, target: Person): string | null {
  const me: Gender = base.gender, t: Gender = target.gender;
  const sibOlder = ageCompare(sib, base) >= 0; // 나이 불명 시 연상으로 폴백
  if (sib.gender === 'female' && t !== 'female') {
    if (me === 'female') return sibOlder ? '형부' : '제부';
    return sibOlder ? '매형' : '매제';
  }
  if (sib.gender === 'male' && t !== 'male') {
    if (me === 'female') return sibOlder ? '새언니' : '올케';
    return sibOlder ? '형수' : '제수';
  }
  return null;
}

// ─── 배우자의 혈족 ────────────────────────────────────────────────────────────
function spouseBloodLabel(
  bp: BloodPath, base: Person, spouse: Person, target: Person, g: Graph
): string {
  const t: Gender = target.gender;
  const F = t === 'female';
  // 남편 쪽 = 시댁, 아내 쪽 = 처가 (내 성별 불명이면 배우자 성별로 판단)
  const husbandSide = base.gender === 'female' || (base.gender !== 'male' && spouse.gender === 'male');
  const { up, down } = bp;

  if (up === 1 && down === 0) {
    return husbandSide ? (F ? '시어머니' : '시아버지') : (F ? '장모' : '장인');
  }
  if (up === 2 && down === 0) {
    const oe = g.byId.get(bp.basePath[1])?.gender === 'female' ? '외' : '';
    return husbandSide ? `시${oe}${F ? '할머니' : '할아버지'}` : `처${oe}${F ? '조모' : '조부'}`;
  }
  if (up === 0 && down === 1) return F ? '의붓딸' : '의붓아들';
  if (up === 1 && down === 1) {
    const cmp = ageCompare(target, spouse);
    if (husbandSide) {
      if (F) return '시누이';
      return cmp >= 0 ? '아주버님' : '시동생';
    }
    if (!F) return '처남';
    return cmp >= 0 ? '처형' : '처제';
  }
  if (up === 1 && down === 2) return husbandSide ? '시조카' : '처조카';

  const label = bloodLabel(bp, spouse, target, g);
  if (up === 2 && down === 1) return `${husbandSide ? '시' : '처'}${label}`;
  return `${husbandSide ? '시댁' : '처가'} ${label}`;
}

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
  const g = getGraph(persons, rels);
  const me: Gender = base.gender;

  // ── 배우자 ──
  const mySpouseIds = g.spousesOf.get(base.id) ?? [];
  if (mySpouseIds.includes(targetId)) return me === 'female' ? '남편' : '아내';

  // ── 혈족 ──
  const bp = findBloodPath(base.id, targetId, g);
  if (bp) return bloodLabel(bp, base, target, g);

  // ── 혈족의 배우자 ──
  for (const relId of g.spousesOf.get(targetId) ?? []) {
    const rel = g.byId.get(relId);
    const rbp = rel && findBloodPath(base.id, relId, g);
    if (!rel || !rbp) continue;
    if (rbp.up === 1 && rbp.down === 1) {
      const lbl = siblingSpouseLabel(rel, base, target);
      if (lbl) return lbl;
    }
    // 사촌의 배우자: 사촌형수 / 사촌매형 / 외사촌올케 …
    if (rbp.up === 2 && rbp.down === 2 && ageCompare(rel, base) !== 0) {
      const lbl = siblingSpouseLabel(rel, base, target);
      if (lbl) return cousinPrefix(rbp, g) + lbl;
    }
    // 여기 도달한 부모의 배우자는 내 친부모가 아님 → 새어머니/새아버지
    const relLabel = bloodLabel(rbp, base, rel, g);
    return SPOUSE_OF[relLabel] ?? `${relLabel}의 ${target.gender === 'female' ? '아내' : '남편'}`;
  }

  // ── 배우자의 혈족 ──
  for (const sid of mySpouseIds) {
    const spouse = g.byId.get(sid);
    const sbp = spouse && findBloodPath(sid, targetId, g);
    if (spouse && sbp) return spouseBloodLabel(sbp, base, spouse, target, g);
  }

  // ── 배우자 형제자매의 배우자 (동서 등) ──
  for (const sid of mySpouseIds) {
    const spouse = g.byId.get(sid);
    if (!spouse) continue;
    for (const relId of g.spousesOf.get(targetId) ?? []) {
      const rbp = findBloodPath(sid, relId, g);
      if (!rbp || rbp.up !== 1 || rbp.down !== 1) continue;
      const rel = g.byId.get(relId);
      const husbandSide = me === 'female' || (me !== 'male' && spouse.gender === 'male');
      if (husbandSide) return rel?.gender === 'female' ? '시누이 남편' : '동서';
      return rel?.gender === 'male' ? '처남댁' : '동서';
    }
  }

  // ── 세대 방향 힌트 폴백 ──
  const gen = getGeneration(targetId, base, rels);
  if (gen > 0) return `${gen}세대 위`;
  if (gen < 0) return `${-gen}세대 아래`;
  return '';
}
