import { useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { Person, Relationship, BranchType } from '../types';
import { classifyBranch, getGeneration, getChusu, canSeeFull, findRoot, getChusuBase } from '../utils/familyGraph';

// ─── Layout constants ─────────────────────────────────────────────────────────
const PERSON_W = 90;
const NODE_H = 110;
const H_GAP = 10;
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
  grantedPersonIds?: Set<string>,
  tempUnlockAll?: boolean
) {
  return useMemo(() => {
    const root = findRoot(persons);
    if (!root) return { nodes: [], edges: [] };

    // 촌수 기준: 뷰포인트가 설정되면 그 사람, 아니면 root
    const chusuBase = getChusuBase(persons, viewpointPersonId) ?? root;
    const isAnon = (p: Person) =>
      !canSeeFull(p, currentUserName, viewpointPersonId, root, grantedPersonIds, relationships, tempUnlockAll);

    // 빠른 조회용: personId → Person
    const personById = new Map(persons.map(p => [p.id, p]));

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
          const member = personById.get(memberId);
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
        if (!branchIdSet.has(childId) && personById.has(childId)) {
          branchIdSet.add(childId);
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
        const members = memberIds.map(id => personById.get(id)!).filter(Boolean);
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

    const meGen = getGeneration(viewpointPersonId ?? root.id, root, relationships);
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
    // gen은 유닛 생성 시 이미 계산됨 (getGeneration 재호출 불필요)
    const unitGenMap = new Map(units.map(u => [u.id, u.gen]));

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
            anons: u.persons.map(isAnon),
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
          anon: isAnon(p),
        },
      };
    });

    // Build edges: parent_child only, routed through unit IDs
    // (커플 유닛은 부부 가운데의 단일 핸들로 들어오고 나간다)
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

      edges.push({
        id: key,
        source: srcId,
        target: tgtId,
        type: 'familyEdge',
        style: { stroke: '#B8A68A', strokeWidth: 2 },
      });
    }

    return { nodes, edges };
  }, [persons, relationships, activeBranch, viewpointPersonId, currentUserName, grantedPersonIds, tempUnlockAll]);
}
