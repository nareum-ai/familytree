import { useState } from 'react';
import type { Person, AddRelationType } from '../types';
import { useFamilyStore } from '../store/familyStore';
import { DateInput } from './DateInput';
import { AvatarPicker } from './AvatarPicker';
import './AddPersonModal.css';

interface Props {
  targetPerson: Person;
  onClose: () => void;
  onDone?: () => void;
}

const ALL_OPTIONS: { type: AddRelationType; label: string; desc: string; genderHint?: 'male' | 'female' }[] = [
  { type: 'father',  label: '아버지',   desc: '부모 (남)',    genderHint: 'male' },
  { type: 'mother',  label: '어머니',   desc: '부모 (여)',    genderHint: 'female' },
  { type: 'sibling', label: '형제/자매', desc: '같은 부모' },
  { type: 'spouse',  label: '배우자',   desc: '남편 / 아내' },
  { type: 'child',   label: '자녀',     desc: '아들 / 딸' },
];

export function AddPersonModal({ targetPerson, onClose, onDone }: Props) {
  const { persons, relationships, addPerson, addRelationship } = useFamilyStore();

  const [relationType, setRelationType] = useState<AddRelationType>('child');
  const [name, setName] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [birthDate, setBirthDate] = useState('');
  const [birthLunar, setBirthLunar] = useState(false);
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [isDeceased, setIsDeceased] = useState(false);
  const [deathDate, setDeathDate] = useState('');
  const [deathLunar, setDeathLunar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [polyConfirmed, setPolyConfirmed] = useState(false);

  // Check existing relations
  const hasFather = relationships.some(r =>
    r.type === 'parent_child' && r.person2_id === targetPerson.id &&
    persons.find(p => p.id === r.person1_id)?.gender === 'male'
  );
  const hasMother = relationships.some(r =>
    r.type === 'parent_child' && r.person2_id === targetPerson.id &&
    persons.find(p => p.id === r.person1_id)?.gender === 'female'
  );
  const hasPrimarySpouse = relationships.some(r => {
    if (r.type !== 'spouse') return false;
    if (r.person1_id !== targetPerson.id && r.person2_id !== targetPerson.id) return false;
    if (!r.is_primary) return false;
    const spouseId = r.person1_id === targetPerson.id ? r.person2_id : r.person1_id;
    return persons.some(p => p.id === spouseId);
  });
  const hasAnySpouse = relationships.some(r => {
    if (r.type !== 'spouse') return false;
    if (r.person1_id !== targetPerson.id && r.person2_id !== targetPerson.id) return false;
    const spouseId = r.person1_id === targetPerson.id ? r.person2_id : r.person1_id;
    return persons.some(p => p.id === spouseId);
  });
  const hasParents = relationships.some(r =>
    r.type === 'parent_child' && r.person2_id === targetPerson.id
  );

  // 다부다처 방지: 배우자 네트워크(BFS) 에서 남/녀 수 계산
  // 추가 후 남 >= 2 && 여 >= 2 가 되는 경우 차단
  const spouseNetwork = (() => {
    const net = new Set<string>([targetPerson.id]);
    const q = [targetPerson.id];
    while (q.length > 0) {
      const curr = q.shift()!;
      for (const r of relationships) {
        if (r.type !== 'spouse') continue;
        const other = r.person1_id === curr ? r.person2_id
          : r.person2_id === curr ? r.person1_id : null;
        if (other && !net.has(other)) { net.add(other); q.push(other); }
      }
    }
    return net;
  })();
  const networkMales   = [...spouseNetwork].filter(id => persons.find(p => p.id === id)?.gender === 'male').length;
  const networkFemales = [...spouseNetwork].filter(id => persons.find(p => p.id === id)?.gender === 'female').length;
  const wouldCreatePolyamory = relationType === 'spouse' && polyConfirmed && (
    (networkMales   + (gender === 'male'   ? 1 : 0)) > 1 &&
    (networkFemales + (gender === 'female' ? 1 : 0)) > 1
  );

  const availableOptions = ALL_OPTIONS.filter(opt => {
    if (opt.type === 'father' && hasFather) return false;
    if (opt.type === 'mother' && hasMother) return false;
    if (opt.type === 'sibling' && !hasParents) return false;
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const opt = ALL_OPTIONS.find(o => o.type === relationType)!;
      const resolvedGender = opt.genderHint || gender;

      const newPerson = await addPerson({
        name: name.trim(),
        photo_url: photoUrl,
        birth_date: birthDate || null,
        birth_lunar: birthLunar,
        gender: resolvedGender,
        is_deceased: isDeceased,
        death_date: isDeceased && deathDate ? deathDate : null,
        death_lunar: isDeceased ? deathLunar : false,
      });

      if (relationType === 'father' || relationType === 'mother') {
        await addRelationship({ person1_id: newPerson.id, person2_id: targetPerson.id, type: 'parent_child' });
        // Auto-link to existing opposite-gender parent as spouse
        const oppositeGender = relationType === 'father' ? 'female' : 'male';
        const existingOtherParent = relationships
          .filter(r => r.type === 'parent_child' && r.person2_id === targetPerson.id)
          .map(r => persons.find(p => p.id === r.person1_id))
          .find(p => p?.gender === oppositeGender);
        if (existingOtherParent) {
          const [p1, p2] = relationType === 'father'
            ? [newPerson.id, existingOtherParent.id]
            : [existingOtherParent.id, newPerson.id];
          // Only create if spouse relationship doesn't already exist
          const alreadySpouse = relationships.some(r =>
            r.type === 'spouse' &&
            ((r.person1_id === p1 && r.person2_id === p2) ||
             (r.person1_id === p2 && r.person2_id === p1))
          );
          if (!alreadySpouse) {
            await addRelationship({ person1_id: p1, person2_id: p2, type: 'spouse' });
          }
        }
      } else if (relationType === 'child') {
        await addRelationship({ person1_id: targetPerson.id, person2_id: newPerson.id, type: 'parent_child' });
      } else if (relationType === 'spouse') {
        // 기존 배우자가 없거나 대표 배우자가 없으면 첫 배우자를 대표로 자동 지정
        await addRelationship({
          person1_id: targetPerson.id,
          person2_id: newPerson.id,
          type: 'spouse',
          is_primary: !hasAnySpouse || !hasPrimarySpouse,
        });

        // 배우자 추가 시 상대방의 기존 자녀에게도 부모 관계 생성
        // 예) 전중섭에게 이인자를 배우자로 추가 → 이인자가 전중섭의 자녀(전현숙 등)의 어머니가 됨
        const targetChildren = relationships
          .filter(r => r.type === 'parent_child' && r.person1_id === targetPerson.id)
          .map(r => r.person2_id);
        for (const childId of targetChildren) {
          const alreadyParent = relationships.some(
            r => r.type === 'parent_child' && r.person1_id === newPerson.id && r.person2_id === childId
          );
          if (!alreadyParent) {
            await addRelationship({ person1_id: newPerson.id, person2_id: childId, type: 'parent_child' });
          }
        }
        // 역방향: 새 배우자에게 기존 자녀가 있으면 targetPerson도 부모로
        const newPersonChildren = relationships
          .filter(r => r.type === 'parent_child' && r.person1_id === newPerson.id)
          .map(r => r.person2_id);
        for (const childId of newPersonChildren) {
          const alreadyParent = relationships.some(
            r => r.type === 'parent_child' && r.person1_id === targetPerson.id && r.person2_id === childId
          );
          if (!alreadyParent) {
            await addRelationship({ person1_id: targetPerson.id, person2_id: childId, type: 'parent_child' });
          }
        }
      } else if (relationType === 'sibling') {
        // Connect new person to same parents as targetPerson
        const parentIds = relationships
          .filter(r => r.type === 'parent_child' && r.person2_id === targetPerson.id)
          .map(r => r.person1_id);
        for (const pid of parentIds) {
          await addRelationship({ person1_id: pid, person2_id: newPerson.id, type: 'parent_child' });
        }
      }
      (onDone ?? onClose)();
    } finally {
      setSaving(false);
    }
  };

  const selectedOpt = ALL_OPTIONS.find(o => o.type === relationType);
  const showGenderPicker = !selectedOpt?.genderHint;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">가족 추가</h2>
        <p className="modal-subtitle"><strong>{targetPerson.name}</strong>의 가족을 추가합니다</p>

        {availableOptions.length === 0 ? (
          <p className="empty-msg">추가할 수 있는 가족이 없습니다.</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="rel-options">
              {availableOptions.map(opt => (
                <button
                  key={opt.type}
                  type="button"
                  className={`rel-btn ${relationType === opt.type ? 'active' : ''}`}
                  onClick={() => {
                    setRelationType(opt.type);
                    if (opt.genderHint) setGender(opt.genderHint);
                    if (opt.type !== 'spouse') setPolyConfirmed(false);
                  }}
                >
                  <span className="rel-label">{opt.label}</span>
                  <span className="rel-desc">{opt.desc}</span>
                </button>
              ))}
            </div>

            {relationType === 'spouse' && hasAnySpouse && !polyConfirmed && (
              <div className="poly-confirm-box">
                <p className="poly-confirm-msg">
                  <strong>{targetPerson.name}</strong>에게 이미 배우자가 있습니다.<br />
                  두 번째 배우자를 추가하면 다처·다부 관계가 됩니다.<br />
                  계속 추가하시겠습니까?
                </p>
                <div className="poly-confirm-btns">
                  <button type="button" className="btn-cancel" onClick={onClose}>취소</button>
                  <button type="button" className="btn-save" onClick={() => setPolyConfirmed(true)}>계속 추가</button>
                </div>
              </div>
            )}

            <div className={`poly-form-area ${relationType === 'spouse' && hasAnySpouse && !polyConfirmed ? 'poly-hidden' : ''}`}>
            <div className="avatar-selector-wrap">
              <button type="button" className="avatar-selector-btn" onClick={() => setShowAvatarPicker(true)}>
                {photoUrl
                  ? <img src={photoUrl} alt="아바타" className="avatar-preview" />
                  : <span className={`avatar-initial-circle ${gender === 'female' ? 'female' : 'male'}`}>
                      {name[0] || '?'}
                    </span>}
              </button>
              <span className="avatar-selector-label">아바타 설정</span>
            </div>

            <div className="form-field name-gender-row">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                autoFocus
                required
              />
              {showGenderPicker && (
                <div className="gender-btns-inline">
                  <button type="button" className={`gender-btn ${gender === 'male' ? 'active male' : ''}`}
                    onClick={() => setGender('male')}>남</button>
                  <button type="button" className={`gender-btn ${gender === 'female' ? 'active female' : ''}`}
                    onClick={() => setGender('female')}>여</button>
                </div>
              )}
            </div>

            <div className="form-field">
              <label>생년월일 (선택)</label>
              <div className="date-row">
                <DateInput
                  value={birthDate}
                  onChange={setBirthDate}
                  max={new Date().toISOString().split('T')[0]}
                />
                <label className="lunar-check">
                  <input type="checkbox" checked={birthLunar} onChange={e => setBirthLunar(e.target.checked)} />
                  음력
                </label>
              </div>
            </div>


            <div className="form-field">
              <label className="deceased-check">
                <input type="checkbox" checked={isDeceased} onChange={e => setIsDeceased(e.target.checked)} />
                고인 (사망)
              </label>
            </div>

            {isDeceased && (
              <div className="form-field">
                <label>기일 / 사망일 (선택)</label>
                <div className="date-row">
                  <DateInput
                    value={deathDate}
                    onChange={setDeathDate}
                    max={new Date().toISOString().split('T')[0]}
                  />
                  <label className="lunar-check">
                    <input type="checkbox" checked={deathLunar} onChange={e => setDeathLunar(e.target.checked)} />
                    음력
                  </label>
                </div>
              </div>
            )}

            {wouldCreatePolyamory && (
              <div className="poly-error-box">
                <p className="poly-error-msg">
                  연결된 배우자 그룹에 남성·여성이 이미 각각 있어<br />
                  이 성별을 추가하면 <strong>다부다처</strong> 관계가 됩니다.<br />
                  성별을 바꾸거나 다른 방식을 선택해 주세요.
                </p>
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={onClose}>취소</button>
              <button type="submit" className="btn-save" disabled={saving || !name.trim() || wouldCreatePolyamory}>
                {saving ? '저장 중...' : '추가'}
              </button>
            </div>
            </div>{/* poly-form-area */}
          </form>
        )}
      </div>
      {showAvatarPicker && (
        <AvatarPicker
          current={photoUrl}
          onSelect={url => setPhotoUrl(url)}
          onClose={() => setShowAvatarPicker(false)}
        />
      )}
    </div>
  );
}
