import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  ReactFlow,
  Background,
  MiniMap,
  Panel,
  useNodesInitialized,
  useReactFlow,
  useStore,
  type Node as RFNode,
  type NodeMouseHandler,
  type FitViewOptions,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useShallow } from 'zustand/react/shallow';

import { useFamilyStore } from '../store/familyStore';
import { getCurrentUserName } from '../lib/storageKeys';
import { getMemberId, isAdminReturn } from '../lib/session';
import { useTreeLayout } from '../hooks/useTreeLayout';
import { classifyBranch, findRoot, getSpouseIds, hasSpouse } from '../utils/familyGraph';
import type { BranchType, Person, Relationship } from '../types';
import { PersonNode } from './PersonNode';
import { CoupleNode } from './CoupleNode';
import { FamilyEdge } from './FamilyEdge';
import { PersonDetail } from './PersonDetail';
import { AddPersonModal } from './AddPersonModal';
import { InfoRequestPanel } from './InfoRequestPanel';
import './FamilyTreeView.css';

const nodeTypes = { personNode: PersonNode, coupleNode: CoupleNode };
const edgeTypes = { familyEdge: FamilyEdge };

const EMPTY_HINT: Record<BranchType, string> = {
  '친가': '아버지를 먼저 추가하세요.',
  '외가': '어머니를 먼저 추가하세요.',
  '처가': '배우자를 먼저 추가하세요.',
  '처외가': '배우자를 먼저 추가하세요.',
};

const isMobileWidth = () => window.innerWidth <= 640;
const focusZoom = () => (isMobileWidth() ? 1.05 : 0.65);

/** "나" 노드(없으면 전체)에 맞춰 화면 이동하는 fitView 옵션 */
function fitToMeOptions(meNodeId: string | null, duration: number, fallbackPadding: number): FitViewOptions {
  return meNodeId
    ? { nodes: [{ id: meNodeId }], maxZoom: focusZoom(), duration, padding: isMobileWidth() ? 0.9 : 1.8 }
    : { maxZoom: focusZoom(), duration, padding: fallbackPadding };
}

/** personId가 포함된 노드 (단독 노드 또는 커플 노드) */
function findNodeOfPerson(nodes: RFNode[], personId: string | null | undefined): RFNode | null {
  if (!personId) return null;
  return nodes.find(n =>
    n.id === personId ||
    (n.type === 'coupleNode' && (n.data as { persons?: Array<{ id: string }> }).persons?.some(p => p.id === personId))
  ) ?? null;
}

// ── 첫 진입·탭 전환 시 "나" 노드 중심 이동 ────────────────────────────────────
// 한 번만 이동하면 이후 화면 크기 측정·권한 로드·뷰포인트 보정으로 레이아웃이 바뀔 때
// "나"가 화면 밖으로 밀려난다 → 사용자가 직접 화면을 움직이기 전까지는
// "나" 노드 좌표·화면 크기가 바뀔 때마다 다시 중심을 맞춘다 (setCenter: 좌표 직접 계산)
// focusTargetId가 있으면 skip=true로 동작 안 함
function FitToMeController({ meNodeId, nodes, activeBranch, skip, userMovedRef }: {
  meNodeId: string | null;
  nodes: RFNode[];
  activeBranch: string;
  skip: boolean;
  userMovedRef: RefObject<boolean>;
}) {
  const { setCenter, fitView, getInternalNode } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const width  = useStore(s => s.width);
  const height = useStore(s => s.height);
  const centeredOnceRef = useRef(false);

  // 탭 전환(또는 "나" 변경) 시 자동 추적 재개 — 아래 중심 이동 effect보다 먼저 선언해야 먼저 실행됨
  const key = `${activeBranch}|${meNodeId ?? ''}`;
  useEffect(() => { userMovedRef.current = false; }, [key, userMovedRef]);

  const me = meNodeId ? nodes.find(n => n.id === meNodeId) : undefined;
  const meX = me?.position.x, meY = me?.position.y;

  useEffect(() => {
    if (skip || userMovedRef.current || !width || !height) return;
    // 첫 진입은 애니메이션 없이 바로 "나"로 — 전체 트리가 잠깐 보였다 이동하는 깜빡임 방지
    const duration = centeredOnceRef.current ? 350 : 0;
    if (!meNodeId || meX === undefined || meY === undefined) {
      if (nodesInitialized && nodes.length > 0) fitView({ maxZoom: focusZoom(), duration, padding: 0.3 });
      return;
    }
    const measured = getInternalNode(meNodeId)?.measured;
    const x = meX + (measured?.width  ?? 90)  / 2;
    const y = meY + (measured?.height ?? 110) / 2;
    centeredOnceRef.current = true;
    setCenter(x, y, { zoom: focusZoom(), duration });
  }, [key, meNodeId, meX, meY, width, height, nodesInitialized, nodes.length, skip,
      userMovedRef, setCenter, fitView, getInternalNode]);

  return null;
}

// ── 기념일/검색 포커스 이동 ───────────────────────────────────────────────────
// fitView 대신 setCenter 사용: nodes.position을 직접 읽어 좌표 계산
// → ReactFlow 내부 스토어 타이밍에 전혀 의존하지 않음
function FocusTargetController({ personId, nodes }: { personId: string | null; nodes: RFNode[] }) {
  const { setCenter } = useReactFlow();

  useEffect(() => {
    const n = findNodeOfPerson(nodes, personId);
    if (!n) return;
    const x = n.position.x + (n.width  ?? 90)  / 2;
    const y = n.position.y + (n.height ?? 110) / 2;
    const t = setTimeout(() => setCenter(x, y, { zoom: focusZoom(), duration: 350 }), 50);
    return () => clearTimeout(t);
  }, [personId, nodes, setCenter]);

  return null;
}

// ── 줌 슬라이더 컨트롤 ────────────────────────────────────────────────────
function ZoomControls() {
  const { zoomIn, zoomOut, zoomTo } = useReactFlow();
  const zoom = useStore((s) => s.transform[2]);

  return (
    <Panel position="bottom-right" className="zoom-controls-panel">
      <div className="zoom-slider-wrap">
        <button className="zoom-step-btn" onClick={() => zoomOut({ duration: 200 })} title="축소">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
        <input
          type="range"
          className="zoom-slider-input"
          min={0.1} max={1.5} step={0.05}
          value={Math.min(1.5, Math.max(0.1, zoom))}
          onChange={e => zoomTo(Number(e.target.value), { duration: 0 })}
        />
        <button className="zoom-step-btn" onClick={() => zoomIn({ duration: 200 })} title="확대">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>
    </Panel>
  );
}

// ── 내 위치로 포커스 버튼 (GPS 스타일) ────────────────────────────────────
function FocusMeButton({ meNodeId }: { meNodeId: string | null }) {
  const { fitView } = useReactFlow();

  return (
    <Panel position="top-right" className="focus-me-panel">
      <button className="focus-me-btn" onClick={() => fitView(fitToMeOptions(meNodeId, 400, 0.3))} title="내 위치로">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="12" cy="12" r="9"/>
          <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
          <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
          <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
        </svg>
        나
      </button>
    </Panel>
  );
}

// 성별에 따른 배우자 쪽 탭 레이블 — 남성: 처가/처외가, 여성: 시가/시외가
function spouseTabLabels(isFemale: boolean) {
  return isFemale
    ? { paternal: '시가', maternal: '시외가' }
    : { paternal: '처가', maternal: '처외가' };
}

type TabConfig = Array<{ branchId: BranchType; label: string }>;

// 내부 브랜치 ID(root 기준)를 보는 사람 기준 탭 레이블로 매핑한다.
// 예) root(남)의 아내 시점: 처가 탭 → "친가", 친가 탭 → "시가"
function getTabConfig(
  viewpointId: string | null,
  persons: Person[],
  relationships: Relationship[]
): TabConfig {
  const root = findRoot(persons);
  const viewpoint = viewpointId ? persons.find(p => p.id === viewpointId) : null;

  // 루트 시점
  if (!root || !viewpoint || viewpoint.id === root.id) {
    const { paternal, maternal } = spouseTabLabels((viewpoint ?? root)?.gender === 'female');
    return [
      { branchId: '친가',   label: '친가' },
      { branchId: '외가',   label: '외가' },
      { branchId: '처가',   label: paternal },
      { branchId: '처외가', label: maternal },
    ];
  }

  const { paternal, maternal } = spouseTabLabels(viewpoint.gender === 'female');
  const vHasSpouse = hasSpouse(viewpoint.id, relationships);
  const rootSpouseIds = getSpouseIds(root.id, relationships);

  // 루트의 배우자 시점: 루트의 처가 쪽이 내 친가/외가, 루트 쪽이 시가(처가)
  if (rootSpouseIds.includes(viewpoint.id)) {
    return [
      { branchId: '처가',   label: '친가' },
      { branchId: '처외가', label: '외가' },
      { branchId: '친가',   label: paternal },
      { branchId: '외가',   label: maternal },
    ];
  }

  // 루트 부부의 자녀 시점: 아버지(root)쪽=친가, 어머니쪽=외가
  const parentIds = relationships
    .filter(r => r.type === 'parent_child' && r.person2_id === viewpoint.id)
    .map(r => r.person1_id);
  const fatherId = parentIds.find(pid => {
    const p = persons.find(q => q.id === pid);
    return p?.gender === 'male' || p?.is_root === 1;
  });
  const motherId = parentIds.find(pid => pid !== fatherId);

  if (fatherId === root.id && motherId && rootSpouseIds.includes(motherId)) {
    const base: TabConfig = [
      { branchId: '친가', label: '친가' },  // 아버지쪽
      { branchId: '처가', label: '외가' },  // 어머니쪽
    ];
    // 배우자 있으면 배우자쪽 탭 추가 (뷰포인트 본인의 처가/시가)
    return vHasSpouse
      ? [...base, { branchId: '처외가', label: paternal }, { branchId: '외가', label: maternal }]
      : base;
  }

  // 처가/처외가 가족 출신 시점: 그 사람 입장에서 처가=친가, 처외가=외가
  const viewpointBranches = classifyBranch(viewpoint.id, persons, relationships);
  const inSpouseOnly =
    (viewpointBranches.includes('처가') || viewpointBranches.includes('처외가')) &&
    !viewpointBranches.includes('친가') &&
    !viewpointBranches.includes('외가');

  if (inSpouseOnly) {
    return [
      { branchId: '처가',   label: '친가' },
      { branchId: '처외가', label: '외가' },
      ...(vHasSpouse
        ? [
            { branchId: '친가' as BranchType, label: paternal },
            { branchId: '외가' as BranchType, label: maternal },
          ]
        : []),
    ];
  }

  // 그 외: 배우자가 없으면 시가/처가 탭은 의미 없음 → 친가/외가만 표시
  return [
    { branchId: '친가', label: '친가' },
    { branchId: '외가', label: '외가' },
    ...(vHasSpouse
      ? [
          { branchId: '처가' as BranchType,   label: paternal },
          { branchId: '처외가' as BranchType, label: maternal },
        ]
      : []),
  ];
}

/** 관리자 "가족 보기"(MEMBER_ID 없음)는 전체 공개, "계정 접속"(MEMBER_ID 있음)은 해당 계정 권한 적용 */
function getViewerAccountName(): string | null {
  const isAdminFamilyView = isAdminReturn() && !getMemberId();
  return isAdminFamilyView ? null : getCurrentUserName();
}

type FocusRequest = ReturnType<typeof useFamilyStore.getState>['focusRequest'];

export function FamilyTreeView() {
  const { persons, relationships, selectedPersonId, viewpointPersonId, focusRequest,
          grantedPersonIds, tempUnlockAll, infoRequestPersonId } = useFamilyStore(
    useShallow(s => ({
      persons: s.persons, relationships: s.relationships, selectedPersonId: s.selectedPersonId,
      viewpointPersonId: s.viewpointPersonId, focusRequest: s.focusRequest,
      grantedPersonIds: s.grantedPersonIds, tempUnlockAll: s.tempUnlockAll,
      infoRequestPersonId: s.infoRequestPersonId,
    }))
  );
  const { selectPerson, clearFocusRequest, openInfoRequest, closeInfoRequest } = useFamilyStore.getState();

  const tabConfig = useMemo(
    () => getTabConfig(viewpointPersonId, persons, relationships),
    [viewpointPersonId, persons, relationships]
  );
  const firstBranch = tabConfig[0].branchId;

  const [activeBranch, setActiveBranch] = useState<BranchType>(firstBranch);
  const [showAddModal, setShowAddModal] = useState(false);
  const [focusTargetId, setFocusTargetId] = useState<string | null>(null);

  // 뷰포인트 변경으로 첫 탭이 바뀌면 첫 탭으로 리셋 (렌더 중 상태 조정 패턴)
  const [prevFirstBranch, setPrevFirstBranch] = useState(firstBranch);
  if (prevFirstBranch !== firstBranch) {
    setPrevFirstBranch(firstBranch);
    setActiveBranch(firstBranch);
  }

  // 기념일/검색 클릭으로 온 포커스 요청: 해당 브랜치로 전환 + 타겟 인물 ID 로컬에 보관
  const [handledFocus, setHandledFocus] = useState<FocusRequest>(null);
  if (focusRequest && focusRequest !== handledFocus) {
    setHandledFocus(focusRequest);
    setActiveBranch(focusRequest.branchId);
    setFocusTargetId(focusRequest.personId);
  }
  useEffect(() => {
    if (focusRequest) clearFocusRequest();
  }, [focusRequest, clearFocusRequest]);

  const { nodes, edges } = useTreeLayout(
    persons, relationships, activeBranch, viewpointPersonId,
    getViewerAccountName(), grantedPersonIds, tempUnlockAll
  );

  const rootId = findRoot(persons)?.id;
  // "나" 노드 ID — 탭 전환 시 중심점 (focusTargetId와 무관)
  const mePersonId = viewpointPersonId ?? rootId;
  const meNodeId = useMemo(() => findNodeOfPerson(nodes, mePersonId)?.id ?? null, [nodes, mePersonId]);
  const userMovedRef = useRef(false);

  const selectedPerson = selectedPersonId
    ? persons.find(p => p.id === selectedPersonId) ?? null
    : null;

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      if (node.type === 'coupleNode') return;
      // 비공개 노드 클릭 → 정보공개 요청 패널
      if (node.data?.anon) {
        openInfoRequest(node.id);
        return;
      }
      selectPerson(node.id === selectedPersonId ? null : node.id);
    },
    [selectedPersonId, selectPerson, openInfoRequest]
  );

  const onPaneClick = useCallback(() => selectPerson(null), [selectPerson]);

  const miniMapNodeColor = useCallback((node: RFNode) => {
    const isMe = (p?: Person) => p?.id === mePersonId;
    if (node.type === 'coupleNode') {
      const d = node.data as { persons?: Person[] };
      return d.persons?.some(isMe) ? '#B7862B' : '#3D7563';
    }
    const p = node.data?.person as Person | undefined;
    if (isMe(p)) return '#B7862B';
    if (node.data?.anon) return '#D6C8B0';
    return p?.gender === 'male' ? '#3D7563' : '#C0603C';
  }, [mePersonId]);

  return (
    <div className="tree-container">
      <div className="branch-tabs">
        {tabConfig.map(tab => (
          <button
            key={tab.branchId}
            className={`branch-tab ${activeBranch === tab.branchId ? 'active' : ''}`}
            onClick={() => { setActiveBranch(tab.branchId); setFocusTargetId(null); selectPerson(null); }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flow-wrapper">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodesDraggable={false}
          nodesConnectable={false}
          // 사용자가 직접 끌거나 확대한 순간부터는 "나" 자동 추적 중단 (코드로 이동할 땐 event가 null)
          onMoveStart={e => { if (e) userMovedRef.current = true; }}
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <FitToMeController meNodeId={meNodeId} nodes={nodes} activeBranch={activeBranch}
                             skip={!!focusTargetId} userMovedRef={userMovedRef} />
          <FocusTargetController personId={focusTargetId} nodes={nodes} />
          <Background color="#E6DCCB" gap={28} size={1} />
          <ZoomControls />
          <FocusMeButton meNodeId={meNodeId} />
          <MiniMap
            position="bottom-right"
            pannable zoomable
            nodeColor={miniMapNodeColor}
            style={{ background: '#FFFDF8' }}
          />
        </ReactFlow>

        {nodes.length === 0 && (
          <div className="empty-branch">
            <p>이 탭에 아직 등록된 가족이 없습니다.</p>
            <p className="empty-hint">{EMPTY_HINT[activeBranch]}</p>
          </div>
        )}
      </div>

      {infoRequestPersonId && (
        <InfoRequestPanel
          key={infoRequestPersonId}
          personId={infoRequestPersonId}
          onClose={closeInfoRequest}
        />
      )}

      {selectedPerson && (
        <PersonDetail
          key={selectedPerson.id}
          person={selectedPerson}
          onAddFamily={() => setShowAddModal(true)}
          onClose={() => selectPerson(null)}
        />
      )}

      {showAddModal && selectedPerson && (
        <AddPersonModal
          targetPerson={selectedPerson}
          onClose={() => setShowAddModal(false)}
          onDone={() => { setShowAddModal(false); selectPerson(null); }}
        />
      )}
    </div>
  );
}
