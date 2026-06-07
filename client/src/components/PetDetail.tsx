import { useState } from 'react';
import type { Person } from '../types';
import { useFamilyStore } from '../store/familyStore';
import { getManAge, getAgeAtDeath } from '../utils/age';
import { DateInput } from './DateInput';
import { AvatarPicker } from './AvatarPicker';
import './PersonDetail.css';

interface Props {
  pet: Person;
  onClose: () => void;
}

const SPECIES_OPTIONS = ['강아지', '고양이', '기타'];

const fmtDate = (d: string | null | undefined, lunar?: boolean) => {
  if (!d) return null;
  return `${d.replace(/-/g, '.')}${lunar ? ' (음력)' : ''}`;
};

export function PetDetail({ pet, onClose }: Props) {
  const { persons, updatePerson, deletePerson, selectPerson } = useFamilyStore();
  const owner = persons.find(p => p.id === pet.owner_person_id) ?? null;
  const siblings = persons.filter(p => p.is_pet && p.owner_person_id === pet.owner_person_id && p.id !== pet.id);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(pet.name);
  const [species, setSpecies] = useState(pet.species ?? '');
  const [gender, setGender] = useState<'male' | 'female' | null>(pet.gender ?? null);
  const [birthDate, setBirthDate] = useState(pet.birth_date ?? '');
  const [birthLunar, setBirthLunar] = useState(pet.birth_lunar ?? false);
  const [isDeceased, setIsDeceased] = useState(pet.is_deceased ?? false);
  const [deathDate, setDeathDate] = useState(pet.death_date ?? '');
  const [deathLunar, setDeathLunar] = useState(pet.death_lunar ?? false);
  const [photoUrl, setPhotoUrl] = useState(pet.photo_url ?? '');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const manAge = pet.birth_date ? getManAge(pet.birth_date) : null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePerson(pet.id, {
        name,
        species: species.trim() || null,
        gender,
        birth_date: birthDate || null,
        birth_lunar: birthLunar,
        is_deceased: isDeceased,
        death_date: isDeceased && deathDate ? deathDate : null,
        death_lunar: isDeceased ? deathLunar : false,
        photo_url: photoUrl || null,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`${pet.name}을(를) 삭제하시겠습니까?`)) return;
    await deletePerson(pet.id);
    onClose();
  };

  return (
    <div className="detail-panel">
      <div className="detail-header">
        {!editing && (
          <div className={`detail-hex ${pet.gender === 'female' ? 'female' : 'male'} ${pet.is_deceased ? 'deceased' : ''}`}>
            {pet.photo_url ? <img src={pet.photo_url} alt={pet.name} /> : <span>🐾</span>}
          </div>
        )}
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      {!editing ? (
        <div className="detail-info">
          <h2 className="detail-name">
            {pet.is_deceased && <span className="deceased-mark">†</span>}
            {pet.name}
          </h2>
          <div className="detail-meta">
            <span className="meta-chip">🐾 {pet.species || '반려동물'}</span>
            {manAge !== null && <span className="meta-chip">만 {manAge}세</span>}
            {fmtDate(pet.birth_date, pet.birth_lunar) && (
              <span className="meta-chip">{fmtDate(pet.birth_date, pet.birth_lunar)}생</span>
            )}
            {pet.is_deceased && fmtDate(pet.death_date, pet.death_lunar) && (
              <span className="meta-chip deceased-chip">기일 {fmtDate(pet.death_date, pet.death_lunar)}</span>
            )}
            {pet.is_deceased && pet.birth_date && pet.death_date && (
              <span className="meta-chip">향년 {getAgeAtDeath(pet.birth_date, pet.death_date)}세</span>
            )}
          </div>

          {owner && (
            <div className="detail-meta">
              <span className="meta-chip accent" style={{ cursor: 'pointer' }} onClick={() => selectPerson(owner.id)}>
                주인: {owner.name}
              </span>
            </div>
          )}

          {siblings.length > 0 && (
            <div className="detail-meta">
              {siblings.map(s => (
                <span key={s.id} className="meta-chip" style={{ cursor: 'pointer' }} onClick={() => selectPerson(s.id)}>
                  🐾 {s.name}
                </span>
              ))}
            </div>
          )}

          <div className="detail-btn-row">
            <button className="btn-edit" onClick={() => setEditing(true)}>편집</button>
            <button className="btn-delete-sm" onClick={handleDelete}>삭제</button>
          </div>
        </div>
      ) : (
        <div className="edit-form">
          <div className="avatar-selector-wrap">
            <button type="button" className="avatar-selector-btn" onClick={() => setShowAvatarPicker(true)}>
              {photoUrl
                ? <img src={photoUrl} alt="아바타" className="avatar-preview" />
                : <span className="avatar-initial-circle male">🐾</span>}
            </button>
            <span className="avatar-selector-label">아바타 설정</span>
            {photoUrl && (
              <button type="button" className="edit-avatar-remove-link" onClick={() => setPhotoUrl('')}>
                아바타 삭제
              </button>
            )}
          </div>

          <div className="form-field">
            <label>이름</label>
            <input className="edit-input" value={name} onChange={e => setName(e.target.value)} placeholder="이름" required />
          </div>

          <div className="form-field">
            <label>종류</label>
            <input className="edit-input" value={species} onChange={e => setSpecies(e.target.value)}
              placeholder="예: 강아지, 고양이" list="pet-species-options" maxLength={20} />
            <datalist id="pet-species-options">
              {SPECIES_OPTIONS.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>

          <div className="form-field">
            <label>성별 (선택)</label>
            <div className="gender-btns-inline">
              <button type="button" className={`gender-btn ${gender === 'male' ? 'active male' : ''}`}
                onClick={() => setGender(g => g === 'male' ? null : 'male')}>수컷</button>
              <button type="button" className={`gender-btn ${gender === 'female' ? 'active female' : ''}`}
                onClick={() => setGender(g => g === 'female' ? null : 'female')}>암컷</button>
            </div>
          </div>

          <div className="form-field">
            <label>생일 (선택)</label>
            <div className="date-row">
              <DateInput value={birthDate} onChange={setBirthDate}
                max={new Date().toISOString().split('T')[0]} />
              <label className="lunar-check">
                <input type="checkbox" checked={birthLunar} onChange={e => setBirthLunar(e.target.checked)} />
                음력
              </label>
            </div>
          </div>

          <div className="form-field">
            <label className="deceased-check">
              <input type="checkbox" checked={isDeceased} onChange={e => setIsDeceased(e.target.checked)} />
              무지개 다리를 건넘 (사망)
            </label>
          </div>

          {isDeceased && (
            <div className="form-field">
              <label>기일 (선택)</label>
              <div className="date-row">
                <DateInput value={deathDate} onChange={setDeathDate}
                  max={new Date().toISOString().split('T')[0]} />
                <label className="lunar-check">
                  <input type="checkbox" checked={deathLunar} onChange={e => setDeathLunar(e.target.checked)} />
                  음력
                </label>
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" onClick={() => setEditing(false)} className="btn-cancel">취소</button>
            <button type="button" onClick={handleSave} disabled={saving || !name.trim()} className="btn-save">
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}

      {showAvatarPicker && (
        <AvatarPicker
          current={photoUrl || null}
          onSelect={url => setPhotoUrl(url ?? '')}
          onClose={() => setShowAvatarPicker(false)}
        />
      )}
    </div>
  );
}
