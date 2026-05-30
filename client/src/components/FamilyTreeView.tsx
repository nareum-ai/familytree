import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useFamilyStore } from '../store/familyStore';
import { useTreeLayout, classifyBranch } from '../hooks/useTreeLayout';
import type { BranchType, Person, Relationship } from '../types';
import { PersonNode } from './PersonNode';
import { CoupleNode } from './CoupleNode';
import { PersonDetail } from './PersonDetail';
import { AddPersonModal } from './AddPersonModal';
import { InfoRequestPanel } from './InfoRequestPanel';
import './FamilyTreeView.css';

const nodeTypes = { personNode: PersonNode, coupleNode: CoupleNode };

// 탭 전환 시 전체 브랜치를 보여주되 "나" 노드가 보이는 수준으로 포커스
function FitToMeController({
  meNodeId,
  activeBranch,
}: {
  meNodeId: string | null;
  activeBranch: string;
}) {
  const { fitView, getNodes } = useReactFlow();

  useEffect(() => {
    const t = setTimeout(() => {
      const allNodes = getNodes();
      if (allNodes.length === 0) return;

      if (meNodeId) {
        // 나 노드 + 나 노드의 부모/자녀 2세대를 함께 보여줌
        fitView({
          nodes: [{ id: meNodeId }],
          maxZoom: 0.65,
          duration: 350,
          padding: 1.8,   // 넉넉한 여백 → 위아래 세대가 함께 보임
        });
      } else {
        // me 노드 없으면 전체 트리 맞춤
        fitView({ maxZoom: 0.65, duration: 350, padding: 0.3 });
      }
    }, 100);
    return () => clearTimeout(t);
  }, [meNodeId, activeBranch, fitView, getNodes]);

  return null;
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

  // 뷰포인트 변경 시 첫 탭으로 리셋
  useEffect(() => {
    setActiveBranch(tabConfig[0].branchId);
  }, [tabConfig[0].branchId]);

  // 기념일 클릭으로 온 포커스 요청: 해당 브랜치로 전환
  useEffect(() => {
    if (!focusRequest) return;
    setActiveBranch(focusRequest.branchId);
    clearFocusRequest();
  }, [focusRequest]);

  const isAdminReturn = localStorage.getItem('familyTreeAdminReturn') === 'true';
  // created_by 비교용: 계정 아이디 우선, 없으면 인물명 폴백 (레거시 데이터 대응)
  const currentUserName = isAdminReturn ? null
    : (localStorage.getItem('familyTreeAccountName') ?? localStorage.getItem('familyTreeUser'));

  const { nodes, edges } = useTreeLayout(
    persons, relationships, activeBranch, viewpointPersonId,
    currentUserName, grantedPersonIds
  );

  // 포커스할 인물 ID (기념일 클릭 > ME > root 순)
  const mePersonId = viewpointPersonId ?? persons.find(p => p.is_root === 1)?.id;

  // store에서 온 focusRequest를 한 번만 처리하기 위해 ref로 저장
  const pendingFocusPersonId = useFamilyStore(s => s.focusRequest?.personId ?? null);

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

  const meNodeId = useMemo(
    () => findNodeId(pendingFocusPersonId) ?? findNodeId(mePersonId),
    [findNodeId, pendingFocusPersonId, mePersonId]
  );

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
            onClick={() => { setActiveBranch(tab.branchId); selectPerson(null); }}
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
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <FitToMeController meNodeId={meNodeId} activeBranch={activeBranch} />
          <Background color="#e8f4f8" gap={24} size={1} />
          <Controls />
          <MiniMap
            pannable
            zoomable
            nodeColor={(node) => {
              if (node.type === 'coupleNode') return '#2AABE2';
              const p = node.data?.person as Person | undefined;
              if (p?.is_root) return '#e2a32a';
              return p?.gender === 'male' ? '#2AABE2' : '#e27ba2';
            }}
            style={{ background: '#f0f7fb' }}
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
        />
      )}
    </div>
  );
}
