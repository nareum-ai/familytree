import { useEffect, useState } from 'react';
import type { EditGrant, Person } from '../types';
import { useFamilyStore } from '../store/familyStore';

const MAX_RESULTS = 8;

/** 인물 편집 권한을 다른 사람에게 위임/회수 (원 소유자만 사용) */
export function EditGrantSection({ person }: { person: Person }) {
  const persons                 = useFamilyStore(s => s.persons);
  const loadEditGrantsForPerson = useFamilyStore(s => s.loadEditGrantsForPerson);
  const grantEditAccess         = useFamilyStore(s => s.grantEditAccess);
  const revokeEditAccess        = useFamilyStore(s => s.revokeEditAccess);

  const [editGrants, setEditGrants] = useState<EditGrant[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadEditGrantsForPerson(person.id).then(setEditGrants).catch(() => {});
  }, [person.id, loadEditGrantsForPerson]);

  const closePicker = () => { setShowPicker(false); setSearch(''); };

  const handleGrant = async (grantee: Person) => {
    await grantEditAccess(person.id, grantee.id, grantee.name);
    setEditGrants(await loadEditGrantsForPerson(person.id));
    closePicker();
  };

  const handleRevoke = async (grant: EditGrant) => {
    await revokeEditAccess(grant.id, grant.person_id, grant.grantee_person_id);
    setEditGrants(list => list.filter(x => x.id !== grant.id));
  };

  const q = search.trim();
  const candidates = q
    ? persons
        .filter(p => p.id !== person.id
          && !editGrants.some(g => g.grantee_person_id === p.id)
          && p.name.includes(q))
        .slice(0, MAX_RESULTS)
    : [];

  return (
    <div className="edit-grant-section">
      <p className="edit-grant-desc">이 인물의 정보를 편집할 수 있는 권한을 다른 사람에게 부여합니다</p>
      {editGrants.length > 0 && (
        <div className="detail-meta">
          {editGrants.map(g => (
            <span key={g.id} className="meta-chip">
              {g.grantee_name}
              <button type="button" className="edit-grant-revoke-btn" onClick={() => handleRevoke(g)}>✕</button>
            </span>
          ))}
        </div>
      )}
      {showPicker ? (
        <div className="edit-grant-picker">
          <input
            className="edit-grant-search-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름으로 검색"
            autoFocus
          />
          {q && (
            <div className="edit-grant-results">
              {candidates.map(p => (
                <div key={p.id} className="edit-grant-result-row" onClick={() => handleGrant(p)}>
                  {p.name}
                </div>
              ))}
            </div>
          )}
          <button type="button" className="edit-grant-cancel-btn" onClick={closePicker}>취소</button>
        </div>
      ) : (
        <button type="button" className="btn-action-link" onClick={() => setShowPicker(true)}>
          + 권한 추가
        </button>
      )}
    </div>
  );
}
