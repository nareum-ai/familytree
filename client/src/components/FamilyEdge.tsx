import type { EdgeProps } from '@xyflow/react';

const BRANCH_Y = 8; // 부모 아래 고정 분기 높이

export function FamilyEdge({
  id, sourceX, sourceY, targetX, targetY, style,
}: EdgeProps) {
  const junctionY = sourceY + BRANCH_Y;

  // 부모 중심 → junctionY 수직 → targetX 수평 → 자식 수직
  const d = `M ${sourceX} ${sourceY} L ${sourceX} ${junctionY} L ${targetX} ${junctionY} L ${targetX} ${targetY}`;

  return (
    <path
      id={id}
      d={d}
      fill="none"
      style={style}
      className="react-flow__edge-path"
    />
  );
}
