import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { Person } from '../types';
import { useFamilyStore } from '../store/familyStore';
import { getManAge, getAgeAtDeath } from '../utils/age';
import './CoupleNode.css';
import { Icon } from './Icon';
import { useRelationLabel } from '../hooks/useRelationLabel';

interface CoupleNodeData {
  persons: Person[];
  chusus: (number | null)[];
  hiddenDescendants?: number;
  anons?: boolean[];
}


function HexAvatar({
  person, chusu, selected, showME, anon, onClick,
}: {
  person: Person; chusu: number | null; selected: boolean; showME: boolean;
  anon: boolean; onClick: (e: React.MouseEvent) => void;
}) {
  const isMale = person.gender === 'male';
  const deceased = person.is_deceased;
  const relation = useRelationLabel(person.id);

  if (anon) {
    return (
      <div className="chex anon-chex" onClick={onClick}>
        {chusu !== null && chusu > 0 && <div className="chusu-badge">{chusu}촌</div>}
        <div className="chex-shape-wrapper">
          <div className="chex-shape anon-hex"><span className="anon-icon"><Icon name="lock" /></span></div>
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
      <div className="chex-shape-wrapper">
        <div className="chex-shape">
          {person.photo_url
            ? <div className="avatar-hex-inner"><img src={person.photo_url} alt={person.name} /></div>
            : <span className="chex-initial">{person.name[0]}</span>}
        </div>
      </div>
      <div className="chex-name">{deceased && <span className="deceased-prefix">故</span>}{person.name}</div>
      {(showME || relation) && <div className="node-relation">{showME ? '나' : relation}</div>}
      {person.birth_date && (
        <div className="chex-age">
          {person.is_deceased && person.death_date
            ? `향 ${getAgeAtDeath(person.birth_date, person.death_date)}`
            : `${getManAge(person.birth_date)}세`}
        </div>
      )}
    </div>
  );
}

export const CoupleNode = memo(({ data }: { data: unknown }) => {
  const { persons, chusus, hiddenDescendants, anons } = data as CoupleNodeData;
  const selectedPersonId  = useFamilyStore(s => s.selectedPersonId);
  const viewpointPersonId = useFamilyStore(s => s.viewpointPersonId);
  const selectPerson      = useFamilyStore(s => s.selectPerson);
  const openInfoRequest   = useFamilyStore(s => s.openInfoRequest);

  const toggle = (id: string, isAnon: boolean) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAnon) {
      openInfoRequest(id);
    } else {
      selectPerson(selectedPersonId === id ? null : id);
    }
  };

  return (
    <div className="couple-node">
      {/* 부모에서 내려오는 선은 부부 가운데로 연결 */}
      <Handle type="target" position={Position.Top}
        style={{ opacity: 0, left: '50%' }} />
      <div className="couple-row">
        {persons.map((p, i) => (
          <HexAvatar key={p.id} person={p} chusu={chusus[i]}
            selected={selectedPersonId === p.id}
            showME={viewpointPersonId ? viewpointPersonId === p.id : p.is_root === 1}
            anon={!!(anons?.[i])}
            onClick={toggle(p.id, !!(anons?.[i]))} />
        ))}
      </div>

      <Handle type="source" position={Position.Bottom}
        style={{ opacity: 0, left: '50%' }} />
      {hiddenDescendants ? (
        <div className="couple-hidden-badge">▼ {hiddenDescendants}명</div>
      ) : null}
    </div>
  );
});
