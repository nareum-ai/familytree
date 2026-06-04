import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  MiniMap,
  Panel,
  useReactFlow,
  useStore,
  type Node as RFNode,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useFamilyStore } from '../store/familyStore';
import { useTreeLayout, classifyBranch } from '../hooks/useTreeLayout';
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

// ── 탭 전환 시 "나" 노드 중심 이동 ──────────────────────────────────────────
// focusTargetId가 있으면 skip=true로 동작 안 함
function FitToMeController({
  meNodeId,
  activeBranch,
  skip,
}: {
  meNodeId: string | null;
  activeBranch: string;
  skip: boolean;
}) {
  const { fitView, getNodes } = useReactFlow();

  useEffect(() => {
    if (skip) return;
    const t = setTimeout(() => {
      if (getNodes().length === 0) return;
      const isMobile = window.innerWidth <= 640;
      if (meNodeId) {
        fitView({ nodes: [{ id: meNodeId }], maxZoom: isMobile ? 0.95 : 0.65, duration: 350, padding: isMobile ? 0.9 : 1.8 });
      } else {
        fitView({ maxZoom: isMobile ? 0.95 : 0.65, duration: 350, padding: isMobile ? 0.4 : 0.3 });
      }
    }, 100);
    return () => clearTimeout(t);
  }, [meNodeId, activeBranch, skip, fitView, getNodes]);

  return null;
}

// ── 기념일/검색 포커스 이동 ───────────────────────────────────────────────────
// fitView 대신 setCenter 사용: nodes.position을 직접 읽어 좌표 계산
// → ReactFlow 내부 스토어 타이밍에 전혀 의존하지 않음
function FocusTargetController({
  personId,
  nodes,
}: {
  personId: string | null;
  nodes: RFNode[];
}) {
  const { setCenter } = useReactFlow();

  useEffect(() => {
    if (!personId || nodes.length === 0) return;

    // 타깃 인물이 속한 노드의 위치와 크기를 nodes 배열에서 직접 읽음
    let cx: number | null = null;
    let cy: number | null = null;
    for (const n of nodes) {
      let match = false;
      if (n.id === personId) {
        match = true;
      } else if (n.type === 'coupleNode') {
        const d = n.data as { person1?: { id: string }; person2?: { id: string } };
        match = d.person1?.id === personId || d.person2?.id === personId;
      }
      if (match) {
        cx = n.position.x + (n.width  ?? 90)  / 2;
        cy = n.position.y + (n.height ?? 110) / 2;
        break;
      }
    }
    if (cx === null || cy === null) return;

    const zoom = window.innerWidth <= 640 ? 0.95 : 0.65;
    const x = cx, y = cy;
    const t = setTimeout(() => {
      setCenter(x, y, { zoom, duration: 350 });
    }, 50);
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

  const handleClick = () => {
    const isMobile = window.innerWidth <= 640;
    if (meNodeId) {
      fitView({
        nodes: [{ id: meNodeId }],
        maxZoom: isMobile ? 0.95 : 0.65,
        duration: 400,
        padding: isMobile ? 0.9 : 1.8,
      });
    } else {
      fitView({ maxZoom: isMobile ? 0.95 : 0.65, duration: 400, padding: 0.3 });
    }
  };

  return (
    <Panel position="top-right" className="focus-me-panel">
      <button className="focus-me-btn" onClick={handleClick} title="내 위치로">
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

// Maps internal branch IDs to display labels depending on who is viewing.
// Root (나, male): 친가 / 외가 / 처가 / 처외가
// Root's female spouse (e.g. 전현숙): 친가(=처가) / 외가(=처외가) / 시댁(=친가) / 시외가(=외가)
// 성별에 따른 배우자 쪽 탭 레이블
// 남성(나): 처가 / 처외가
// 여성(나): 시가 / 시외가
function spouseTabLabels(isFemale: boolean) {
  return isFemale
    ? { paternal: '시가', maternal: '시외가' }
    : { paternal: '처가', maternal: '처외가' };
}

function getTabConfig(
  viewpointId: string | null,
  persons: Person[],
  relationships: Relationship[]
): Array<{ branchId: BranchType; label: string }> {
  const root = persons.find(p => p.is_root === 1);
  const viewpoint = viewpointId ? persons.find(p => p.id === viewpointId) : null;

  // 기준 인물 결정 (뷰포인트가 있으면 그 사람, 없으면 root)
  const me = viewpoint ?? root;
  const isFemale = me?.gender === 'female';
  const { paternal, maternal } = spouseTabLabels(isFemale);

  if (!root || !viewpoint || viewpoint.id === root.id) {
    return [
      { branchId: '친가',   label: '친가' },
      { branchId: '외가',   label: '외가' },
      { branchId: '처가',   label: paternal },
      { branchId: '처외가', label: maternal },
    ];
  }

  const isSpouseOfRoot = relationships.some(r =>
    r.type === 'spouse' &&
    ((r.person1_id === viewpoint.id && r.person2_id === root.id) ||
     (r.person2_id === viewpoint.id && r.person1_id === root.id))
  );

  if (isSpouseOfRoot) {
    // 배우자 시점: 뷰포인트 인물의 성별로 레이블 결정
    // 여성(전현숙): 남편 쪽 = 시가/시외가
    // 남성: 아내 쪽 = 처가/처외가
    const { paternal: sp, maternal: sm } = spouseTabLabels(viewpoint.gender === 'female');
    return [
      { branchId: '처가',   label: '친가' },
      { branchId: '처외가', label: '외가' },
      { branchId: '친가',   label: sp },
      { branchId: '외가',   label: sm },
    ];
  }

  // 자녀 시점
  const rootSpouseIds = relationships
    .filter(r => r.type === 'spouse' && (r.person1_id === root.id || r.person2_id === root.id))
    .map(r => r.person1_id === root.id ? r.person2_id : r.person1_id);

  const fatherId = relationships
    .filter(r => r.type === 'parent_child' && r.person2_id === viewpoint.id)
    .map(r => r.person1_id)
    .find(pid => {
      const p = persons.find(q => q.id === pid);
      return p?.gender === 'male' || p?.is_root === 1;
    });

  const motherId = relationships
    .filter(r => r.type === 'parent_child' && r.person2_id === viewpoint.id)
    .map(r => r.person1_id)
    .find(pid => pid !== fatherId);

  if (fatherId === root.id && motherId && rootSpouseIds.includes(motherId)) {
    // 자녀 시점: 아버지쪽=친가, 어머니쪽=외가
    // 배우자 없으면 처가/시가 탭 불필요
    const vHasSpouse = relationships.some(
      r => r.type === 'spouse' && (r.person1_id === viewpoint.id || r.person2_id === viewpoint.id)
    );
    const vIsFemale = viewpoint.gender === 'female';
    const { paternal: vPat, maternal: vMat } = spouseTabLabels(vIsFemale);
    const base: Array<{ branchId: BranchType; label: string }> = [
      { branchId: '친가', label: '친가' },  // 아버지(홍재억)쪽
      { branchId: '처가', label: '외가' },  // 어머니(전현숙)쪽
    ];
    if (!vHasSpouse) return base;
    // 배우자 있으면 배우자쪽 탭 추가 (뷰포인트 본인의 처가/시가)
    return [
      ...base,
      { branchId: '처외가', label: vPat },
      { branchId: '외가',   label: vMat },
    ];
  }

  // 처가/처외가 가족 출신 시점 (전현준 등)
  // classifyBranch가 처가/처외가에만 속하고 친가/외가에 없으면
  // → 그 사람 입장에서 처가=친가, 처외가=외가
  const viewpointBranches = classifyBranch(viewpoint.id, persons, relationships);
  const inSpouseOnly =
    (viewpointBranches.includes('처가') || viewpointBranches.includes('처외가')) &&
    !viewpointBranches.includes('친가') &&
    !viewpointBranches.includes('외가');

  if (inSpouseOnly) {
    const vIsFemale = viewpoint.gender === 'female';
    return [
      { branchId: '처가',   label: '친가' },
      { branchId: '처외가', label: '외가' },
      // 배우자가 있으면 그 쪽도 표시
      ...(relationships.some(r => r.type === 'spouse' && (r.person1_id === viewpoint.id || r.person2_id === viewpoint.id))
        ? [
            { branchId: '친가' as BranchType, label: vIsFemale ? '시가' : '처가' },
            { branchId: '외가' as BranchType, label: vIsFemale ? '시외가' : '처외가' },
          ]
        : []),
    ];
  }

  // 배우자가 없으면 시가/처가 탭은 의미 없음 → 친가/외가만 표시
  const hasOwnSpouse = relationships.some(
    r => r.type === 'spouse' &&
      (r.person1_id === viewpoint.id || r.person2_id === viewpoint.id)
  );

  if (!hasOwnSpouse) {
    return [
      { branchId: '친가', label: '친가' },
      { branchId: '외가', label: '외가' },
    ];
  }

  return [
    { branchId: '친가',   label: '친가' },
    { branchId: '외가',   label: '외가' },
    { branchId: '처가',   label: paternal },
    { branchId: '처외가', label: maternal },
  ];
}

export function FamilyTreeView() {
  const { persons, relationships, selectedPersonId, viewpointPersonId, selectPerson,
          focusRequest, clearFocusRequest, grantedPersonIds,
          infoRequestPersonId, openInfoRequest, closeInfoRequest } = useFamilyStore();

  const tabConfig = useMemo(
    () => getTabConfig(viewpointPersonId, persons, relationships),
    [viewpointPersonId, persons, relationships]
  );

  const [activeBranch, setActiveBranch] = useState<BranchType>(tabConfig[0].branchId);
  const [showAddModal, setShowAddModal] = useState(false);
  const [focusTargetId, setFocusTargetId] = useState<string | null>(null);

  // 뷰포인트 변경 시 첫 탭으로 리셋
  useEffect(() => {
    setActiveBranch(tabConfig[0].branchId);
  }, [tabConfig[0].branchId]);

  // 기념일/검색 클릭으로 온 포커스 요청: 해당 브랜치로 전환 + 타겟 인물 ID 로컬에 보관
  useEffect(() => {
    if (!focusRequest) return;
    setActiveBranch(focusRequest.branchId);
    setFocusTargetId(focusRequest.personId);
    clearFocusRequest();
  }, [focusRequest]);

  const isAdminReturn = localStorage.getItem('familyTreeAdminReturn') === 'true';
  // 관리자 "가족 접속"(MEMBER_ID 없음): 전체 공개
  // 관리자 "계정 접속"(MEMBER_ID 있음): 해당 계정 권한 적용
  const isMemberImpersonation = isAdminReturn && !!localStorage.getItem('familyTreeMemberId');
  const currentUserName = (isAdminReturn && !isMemberImpersonation) ? null
    : (localStorage.getItem('familyTreeAccountName') ?? localStorage.getItem('familyTreeUser'));

  const { nodes, edges } = useTreeLayout(
    persons, relationships, activeBranch, viewpointPersonId,
    currentUserName, grantedPersonIds
  );

  // "나" 노드 ID — 탭 전환 시 중심점 (focusTargetId와 무관)
  const mePersonId = viewpointPersonId ?? persons.find(p => p.is_root === 1)?.id;

  const findNodeId = useCallback((personId: string | null | undefined) => {
    if (!personId) return null;
    for (const n of nodes) {
      if (n.id === personId) return n.id;
      if (n.type === 'coupleNode') {
        const d = n.data as { person1?: { id: string }; person2?: { id: string } };
        if (d.person1?.id === personId || d.person2?.id === personId) return n.id;
      }
    }
    return null;
  }, [nodes]);

  const meNodeId = useMemo(() => findNodeId(mePersonId), [findNodeId, mePersonId]);

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
    [selectedPersonId, selectPerson]
  );

  const onPaneClick = useCallback(() => selectPerson(null), [selectPerson]);

  const emptyHint: Record<BranchType, string> = {
    '친가': '아버지를 먼저 추가하세요.',
    '외가': '어머니를 먼저 추가하세요.',
    '처가': '배우자를 먼저 추가하세요.',
    '처외가': '배우자를 먼저 추가하세요.',
  };

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
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <FitToMeController meNodeId={meNodeId} activeBranch={activeBranch} skip={!!focusTargetId} />
          <FocusTargetController personId={focusTargetId} nodes={nodes} />
          <Background color="#E8EAF0" gap={28} size={1} />
          <ZoomControls />
          <FocusMeButton meNodeId={meNodeId} />
          <MiniMap
            position="bottom-right"
            pannable zoomable
            nodeColor={(node) => {
              const vp = viewpointPersonId;
              const root = persons.find(p => p.is_root === 1);
              if (node.type === 'coupleNode') {
                const d = node.data as { person1?: Person; person2?: Person };
                const isMe = vp
                  ? d.person1?.id === vp || d.person2?.id === vp
                  : d.person1?.is_root === 1 || d.person2?.is_root === 1;
                return isMe ? '#4F46E5' : '#0EA5E9';
              }
              const p = node.data?.person as Person | undefined;
              const isMe = vp ? p?.id === vp : p?.id === root?.id;
              if (isMe) return '#4F46E5';
              if (node.data?.anon) return '#CBD5E1';
              return p?.gender === 'male' ? '#0EA5E9' : '#EC4899';
            }}
            style={{ background: '#ffffff' }}
          />
        </ReactFlow>

        {nodes.length === 0 && (
          <div className="empty-branch">
            <p>이 탭에 아직 등록된 가족이 없습니다.</p>
            <p className="empty-hint">{emptyHint[activeBranch]}</p>
          </div>
        )}
      </div>

      {infoRequestPersonId && (
        <InfoRequestPanel
          personId={infoRequestPersonId}
          onClose={closeInfoRequest}
        />
      )}

      {selectedPerson && (
        <PersonDetail
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
