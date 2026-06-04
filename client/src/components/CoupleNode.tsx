import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { Person } from '../types';
import { useFamilyStore } from '../store/familyStore';
import { getManAge, getAgeAtDeath } from '../utils/age';
import './CoupleNode.css';

interface CoupleNodeData {
  person1: Person;
  person2: Person;
  chusu1: number | null;
  chusu2: number | null;
}


function HexAvatar({
  person, chusu, selected, showME, anon, onClick,
}: {
  person: Person; chusu: number | null; selected: boolean; showME: boolean;
  anon: boolean; onClick: (e: React.MouseEvent) => void;
}) {
  const isMale = person.gender === 'male';
  const deceased = person.is_deceased;

  if (anon) {
    return (
      <div className="chex anon-chex" onClick={onClick}>
        {chusu !== null && chusu > 0 && <div className="chusu-badge">{chusu}촌</div>}
        <div className="chex-shape-wrapper">
          <div className="chex-shape anon-hex"><span className="anon-icon">🔒</span></div>
        </div>
        <div className="chex-name anon-name">비공개</div>
      </div>
    );
  }

  return (
    <div
      className={`chex ${isMale ? 'male' : 'female'} ${showME ? 'me' : ''} ${selected ? 'selected' : ''} ${deceased ? 'deceased' : ''}`}
      onClick={onClick}
    >
      {chusu !== null && chusu > 0 && <div className="chusu-badge">{chusu}촌</div>}
      {showME && <div className="me-badge">나</div>}
      <div className="chex-shape-wrapper">
        <div className="chex-shape">
          {person.photo_url
            ? <div className="avatar-hex-inner"><img src={person.photo_url} alt={person.name} /></div>
            : <span className="chex-initial">{person.name[0]}</span>}
        </div>
      </div>
      <div className="chex-name">{person.name}</div>
      {person.birth_date && (
        <div className="chex-age">
          {person.is_deceased && person.death_date
            ? `(향 ${getAgeAtDeath(person.birth_date, person.death_date)})`
            : `(${getManAge(person.birth_date)})`}
        </div>
      )}
    </div>
  );
}

export const CoupleNode = memo(({ data }: { data: unknown }) => {
  const { person1, person2, chusu1, chusu2, hiddenDescendants, anon1, anon2 } =
    data as CoupleNodeData & { hiddenDescendants?: number; anon1?: boolean; anon2?: boolean };
  const { selectedPersonId, selectPerson, viewpointPersonId, openInfoRequest } = useFamilyStore();

  const toggle = (id: string, isAnon: boolean) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAnon) {
      openInfoRequest(id);   // 비공개 → 정보공개 요청 패널
    } else {
      selectPerson(selectedPersonId === id ? null : id);
    }
  };

  return (
    <div className="couple-node">
      {/* Per-person target handles — parent edges land on the right side */}
      <Handle type="target" id="p1" position={Position.Top}
        style={{ opacity: 0, left: '25%' }} />
      <Handle type="target" id="p2" position={Position.Top}
        style={{ opacity: 0, left: '75%' }} />

      <div className="couple-row">
        <HexAvatar person={person1} chusu={chusu1}
          selected={selectedPersonId === person1.id}
          showME={viewpointPersonId ? viewpointPersonId === person1.id : person1.is_root === 1}
          anon={!!anon1}
          onClick={toggle(person1.id, !!anon1)} />
        <HexAvatar person={person2} chusu={chusu2}
          selected={selectedPersonId === person2.id}
          showME={viewpointPersonId ? viewpointPersonId === person2.id : person2.is_root === 1}
          anon={!!anon2}
          onClick={toggle(person2.id, !!anon2)} />
      </div>

      {/* Children always connect from center bottom */}
      <Handle type="source" position={Position.Bottom}
        style={{ opacity: 0, left: '50%' }} />
      {hiddenDescendants ? (
        <div className="couple-hidden-badge">▼ {hiddenDescendants}명</div>
      ) : null}
    </div>
  );
});
