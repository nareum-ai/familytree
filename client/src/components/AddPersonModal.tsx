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

  // Check existing relations
  const hasFather = relationships.some(r =>
    r.type === 'parent_child' && r.person2_id === targetPerson.id &&
    persons.find(p => p.id === r.person1_id)?.gender === 'male'
  );
  const hasMother = relationships.some(r =>
    r.type === 'parent_child' && r.person2_id === targetPerson.id &&
    persons.find(p => p.id === r.person1_id)?.gender === 'female'
  );
  const hasSpouse = relationships.some(r => {
    if (r.type !== 'spouse') return false;
    if (r.person1_id !== targetPerson.id && r.person2_id !== targetPerson.id) return false;
    // 배우자 person이 실제 존재할 때만 버튼 숨김 (삭제 후 고아 관계 문서 방어)
    const spouseId = r.person1_id === targetPerson.id ? r.person2_id : r.person1_id;
    return persons.some(p => p.id === spouseId);
  });
  const hasParents = relationships.some(r =>
    r.type === 'parent_child' && r.person2_id === targetPerson.id
  );

  const availableOptions = ALL_OPTIONS.filter(opt => {
    if (opt.type === 'father' && hasFather) return false;
    if (opt.type === 'mother' && hasMother) return false;
    if (opt.type === 'spouse' && hasSpouse) return false;
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
        await addRelationship({ person1_id: targetPerson.id, person2_id: newPerson.id, type: 'spouse' });

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
                  }}
                >
                  <span className="rel-label">{opt.label}</span>
                  <span className="rel-desc">{opt.desc}</span>
                </button>
              ))}
            </div>

            <div className="avatar-selector-wrap">
              <button type="button" className="avatar-selector-btn" onClick={() => setShowAvatarPicker(true)}>
                {photoUrl
                  ? <img src={photoUrl} alt="아바타" className="avatar-preview" />
                  : <span className="avatar-placeholder">👤</span>}
                <span className="avatar-edit-badge">✏️</span>
              </button>
            </div>

            <div className="form-field">
              <label>이름</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                autoFocus
                required
              />
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

            {showGenderPicker && (
              <div className="form-field">
                <label>성별</label>
                <div className="gender-btns">
                  <button type="button" className={`gender-btn ${gender === 'male' ? 'active male' : ''}`}
                    onClick={() => setGender('male')}>남</button>
                  <button type="button" className={`gender-btn ${gender === 'female' ? 'active female' : ''}`}
                    onClick={() => setGender('female')}>여</button>
                </div>
              </div>
            )}

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

            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={onClose}>취소</button>
              <button type="submit" className="btn-save" disabled={saving || !name.trim()}>
                {saving ? '저장 중...' : '추가'}
              </button>
            </div>
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
