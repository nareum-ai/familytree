import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { Person } from '../types';
import { getManAge, getAgeAtDeath } from '../utils/age';
import { useFamilyStore } from '../store/familyStore';
import './PersonNode.css';

interface PersonNodeData {
  person: Person;
  chusu: number | null;
  isRoot: boolean;
  hiddenDescendants?: number;
  anon?: boolean;
}


export const PersonNode = memo(({ data, selected }: NodeProps) => {
  const { person, chusu, isRoot, hiddenDescendants, anon } = data as unknown as PersonNodeData;
  const { viewpointPersonId } = useFamilyStore();

  const initial = person.name?.[0] ?? '?';
  const isMale = person.gender === 'male';
  const show나 = viewpointPersonId ? viewpointPersonId === person.id : isRoot;
  const deceased = person.is_deceased;

  // 익명 노드: 작성자가 아닌 경우 회색 잠금 육각형
  if (anon) {
    return (
      <div className="person-node anon-node">
        <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
        {chusu !== null && chusu > 0 && <div className="chusu-badge">{chusu}촌</div>}
        <div className="hex-wrapper">
          <div className="hex-shape anon-hex"><span className="anon-icon">🔒</span></div>
        </div>
        <div className="person-name anon-name">비공개</div>
        <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
        {hiddenDescendants ? <div className="hidden-badge">▼ {hiddenDescendants}명</div> : null}
      </div>
    );
  }

  return (
    <div className={`person-node ${isMale ? 'male' : 'female'} ${show나 ? 'me' : ''} ${selected ? 'selected' : ''} ${deceased ? 'deceased' : ''}`}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />

      {chusu !== null && chusu > 0 && <div className="chusu-badge">{chusu}촌</div>}
      {show나 && <div className="me-badge">나</div>}

      <div className="hex-wrapper">
        <div className="hex-shape">
          {person.photo_url
            ? <img src={person.photo_url} alt={person.name} className="avatar-img" />
            : <div className="avatar-initial">{initial}</div>}
          </div>
      </div>

      <div className="person-name">{person.name}</div>
      {person.birth_date && (
        <div className="person-age">
          {person.is_deceased && person.death_date
            ? `(향 ${getAgeAtDeath(person.birth_date, person.death_date)})`
            : `(${getManAge(person.birth_date)})`}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      {hiddenDescendants ? (
        <div className="hidden-badge">▼ {hiddenDescendants}명</div>
      ) : null}
    </div>
  );
});
