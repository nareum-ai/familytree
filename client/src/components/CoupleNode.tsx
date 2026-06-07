import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { Person } from '../types';
import { useFamilyStore } from '../store/familyStore';
import { getManAge, getAgeAtDeath } from '../utils/age';
import './CoupleNode.css';

interface CoupleNodeData {
  persons: Person[];
  chusus: (number | null)[];
  hiddenDescendants?: number;
  anons?: boolean[];
  pets?: Person[][];
}


function HexAvatar({
  person, chusu, selected, showME, anon, pets, onClick, onPetBadgeClick,
}: {
  person: Person; chusu: number | null; selected: boolean; showME: boolean;
  anon: boolean; pets: Person[]; onClick: (e: React.MouseEvent) => void;
  onPetBadgeClick: (e: React.MouseEvent) => void;
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
        {pets.length > 0 && (
          <div className="pet-badge" onClick={onPetBadgeClick}>🐾{pets.length > 1 ? pets.length : ''}</div>
        )}
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
      {pets.length > 0 && (
        <div className="pet-badge" onClick={onPetBadgeClick}>🐾{pets.length > 1 ? pets.length : ''}</div>
      )}
    </div>
  );
}

export const CoupleNode = memo(({ data }: { data: unknown }) => {
  const { persons, chusus, hiddenDescendants, anons, pets } = data as CoupleNodeData;
  const { selectedPersonId, selectPerson, viewpointPersonId, openInfoRequest } = useFamilyStore();

  const toggle = (id: string, isAnon: boolean) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAnon) {
      openInfoRequest(id);
    } else {
      selectPerson(selectedPersonId === id ? null : id);
    }
  };

  const petBadgeClick = (ownerPets: Person[]) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (ownerPets.length > 0) selectPerson(ownerPets[0].id);
  };

  const n = persons.length;

  return (
    <div className="couple-node">
      {persons.map((_p, i) => (
        <Handle key={i} type="target" id={`p${i}`} position={Position.Top}
          style={{ opacity: 0, left: `${((i + 0.5) / n) * 100}%` }} />
      ))}

      <div className="couple-row">
        {persons.map((p, i) => (
          <HexAvatar key={p.id} person={p} chusu={chusus[i]}
            selected={selectedPersonId === p.id}
            showME={viewpointPersonId ? viewpointPersonId === p.id : p.is_root === 1}
            anon={!!(anons?.[i])}
            pets={pets?.[i] ?? []}
            onClick={toggle(p.id, !!(anons?.[i]))}
            onPetBadgeClick={petBadgeClick(pets?.[i] ?? [])} />
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
