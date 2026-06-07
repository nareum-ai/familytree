import { useState } from 'react';
import type { Person } from '../types';
import { useFamilyStore } from '../store/familyStore';
import { DateInput } from './DateInput';
import { AvatarPicker } from './AvatarPicker';
import './AddPersonModal.css';

interface Props {
  targetPerson: Person;
  onClose: () => void;
  onDone?: () => void;
}

const SPECIES_OPTIONS = ['강아지', '고양이', '기타'];

export function AddPetModal({ targetPerson, onClose, onDone }: Props) {
  const { addPerson } = useFamilyStore();

  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [birthDate, setBirthDate] = useState('');
  const [birthLunar, setBirthLunar] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await addPerson({
        name: name.trim(),
        is_pet: true,
        owner_person_id: targetPerson.id,
        species: species.trim() || null,
        gender,
        photo_url: photoUrl || null,
        birth_date: birthDate || null,
        birth_lunar: birthLunar,
        is_root: 0,
      });
      (onDone ?? onClose)();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">반려동물 추가</h2>
        <p className="modal-subtitle"><strong>{targetPerson.name}</strong>의 반려동물을 추가합니다</p>

        <form onSubmit={handleSubmit}>
          <div className="avatar-selector-wrap">
            <button type="button" className="avatar-selector-btn" onClick={() => setShowAvatarPicker(true)}>
              {photoUrl
                ? <img src={photoUrl} alt="아바타" className="avatar-preview" />
                : <span className="avatar-initial-circle male">🐾</span>}
            </button>
            <span className="avatar-selector-label">아바타 설정</span>
          </div>

          <div className="form-field">
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
            <label>종류</label>
            <input value={species} onChange={e => setSpecies(e.target.value)}
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

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>취소</button>
            <button type="submit" className="btn-save" disabled={saving || !name.trim()}>
              {saving ? '저장 중...' : '추가'}
            </button>
          </div>
        </form>
      </div>
      {showAvatarPicker && (
        <AvatarPicker
          current={photoUrl}
          onSelect={url => setPhotoUrl(url ?? '')}
          onClose={() => setShowAvatarPicker(false)}
        />
      )}
    </div>
  );
}
