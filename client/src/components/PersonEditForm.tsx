import { useState } from 'react';
import type { Person, Relationship } from '../types';
import { useFamilyStore } from '../store/familyStore';
import { todayStr, formatDotDate } from '../utils/date';
import { DateInput } from './DateInput';
import { AvatarPicker } from './AvatarPicker';
import { AvatarSelector } from './AvatarSelector';

const MAX_RECENT_STATUS = 3;

interface Props {
  person: Person;
  /** 결혼기념일을 함께 편집할 대표 배우자 관계 */
  spouseRel: Relationship | null;
  onDone: () => void;
}

export function PersonEditForm({ person, spouseRel, onDone }: Props) {
  const updatePerson       = useFamilyStore(s => s.updatePerson);
  const updateRelationship = useFamilyStore(s => s.updateRelationship);

  const [name, setName] = useState(person.name);
  const [gender, setGender] = useState<'male' | 'female'>(person.gender ?? 'male');
  const [birthDate, setBirthDate] = useState(person.birth_date ?? '');
  const [birthLunar, setBirthLunar] = useState(person.birth_lunar ?? false);
  const [isDeceased, setIsDeceased] = useState(person.is_deceased ?? false);
  const [deathDate, setDeathDate] = useState(person.death_date ?? '');
  const [deathLunar, setDeathLunar] = useState(person.death_lunar ?? false);
  const [marriageDate, setMarriageDate] = useState(spouseRel?.marriage_date ?? '');
  const [marriageLunar, setMarriageLunar] = useState(spouseRel?.marriage_lunar ?? false);
  const [phone, setPhone] = useState(person.phone ?? '');
  const [email, setEmail] = useState(person.email ?? '');
  const [recentStatusList, setRecentStatusList] = useState(person.recent_status ?? []);
  const [newStatusText, setNewStatusText] = useState('');
  const [photoUrl, setPhotoUrl] = useState(person.photo_url ?? '');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const today = todayStr();

  const handleSave = async () => {
    setSaving(true);
    const newText = newStatusText.trim();
    const finalStatusList = newText
      ? [{ text: newText, at: today }, ...recentStatusList].slice(0, MAX_RECENT_STATUS)
      : recentStatusList;
    await updatePerson(person.id, {
      name,
      gender,
      birth_date: birthDate || null,
      birth_lunar: birthLunar,
      is_deceased: isDeceased,
      death_date: isDeceased && deathDate ? deathDate : null,
      death_lunar: isDeceased ? deathLunar : false,
      phone: phone.trim() || null,
      email: email.trim() || null,
      recent_status: finalStatusList.length > 0 ? finalStatusList : null,
      photo_url: photoUrl || null,
    });
    if (spouseRel) {
      await updateRelationship(spouseRel.id, {
        marriage_date: marriageDate || null,
        marriage_lunar: marriageLunar,
      });
    }
    setSaving(false);
    onDone();
  };

  return (
    <div className="edit-form">
      <AvatarSelector photoUrl={photoUrl || null} name={name} gender={gender}
        onOpen={() => setShowAvatarPicker(true)} onRemove={() => setPhotoUrl('')} />

      <div className="form-field name-gender-row">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="이름" required />
        <div className="gender-btns-inline">
          <button type="button" className={`gender-btn ${gender === 'male' ? 'active male' : ''}`}
            onClick={() => setGender('male')}>남</button>
          <button type="button" className={`gender-btn ${gender === 'female' ? 'active female' : ''}`}
            onClick={() => setGender('female')}>여</button>
        </div>
      </div>

      <DateWithLunarField label="생년월일 (선택)" max={today}
        date={birthDate} onDate={setBirthDate} lunar={birthLunar} onLunar={setBirthLunar} />

      <div className="form-field">
        <label className="deceased-check">
          <input type="checkbox" checked={isDeceased} onChange={e => setIsDeceased(e.target.checked)} />
          고인 (사망)
        </label>
      </div>

      {isDeceased && (
        <DateWithLunarField label="기일 / 사망일 (선택)" max={today}
          date={deathDate} onDate={setDeathDate} lunar={deathLunar} onLunar={setDeathLunar} />
      )}

      {spouseRel && (
        <DateWithLunarField label="💍 결혼기념일 (선택)" max={today}
          date={marriageDate} onDate={setMarriageDate} lunar={marriageLunar} onLunar={setMarriageLunar} />
      )}

      <div className="edit-contact-group">
        <div className="form-field">
          <label>휴대폰</label>
          <input value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="휴대폰 번호" maxLength={20} />
        </div>
        <div className="form-field">
          <label>이메일</label>
          <input value={email} onChange={e => setEmail(e.target.value)}
            placeholder="이메일" maxLength={80} />
        </div>
        <div className="form-field">
          <label>근황 <span className="recent-status-hint">(최근 {MAX_RECENT_STATUS}개만 유지)</span></label>
          {recentStatusList.length > 0 && (
            <div className="recent-status-edit-list">
              {recentStatusList.map((s, i) => (
                <div key={i} className="recent-status-edit-entry">
                  <div className="recent-status-edit-text">{s.text}</div>
                  <span className="recent-status-edit-date">{formatDotDate(s.at, false)}</span>
                  <button type="button" className="recent-status-remove-btn"
                    onClick={() => setRecentStatusList(list => list.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
            </div>
          )}
          <textarea value={newStatusText} onChange={e => setNewStatusText(e.target.value)}
            className="edit-input edit-recent-status" placeholder="새 근황을 입력하면 오늘 날짜로 추가됩니다" rows={2} maxLength={150} />
        </div>
      </div>

      <div className="modal-actions">
        <button type="button" onClick={onDone} className="btn-cancel">취소</button>
        <button type="button" onClick={handleSave} disabled={saving || !name.trim()} className="btn-save">
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

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

function DateWithLunarField({ label, max, date, onDate, lunar, onLunar }: {
  label: string; max: string;
  date: string; onDate: (v: string) => void;
  lunar: boolean; onLunar: (v: boolean) => void;
}) {
  return (
    <div className="form-field">
      <label>{label}</label>
      <div className="date-row">
        <DateInput value={date} onChange={onDate} max={max} />
        <label className="lunar-check">
          <input type="checkbox" checked={lunar} onChange={e => onLunar(e.target.checked)} />
          음력
        </label>
      </div>
    </div>
  );
}
