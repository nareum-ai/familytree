import { useMemo, useState } from 'react';
import { useFamilyStore } from '../store/familyStore';
import { useVisiblePersons } from '../hooks/useVisiblePersons';
import { classifyBranch, getChusu, getChusuBase } from '../utils/familyGraph';
import { getRelationLabel } from '../utils/relationLabel';
import './SearchView.css';

interface Props {
  onClose: () => void;
}

export function SearchView({ onClose }: Props) {
  const { persons, relationships, viewpointPersonId, visiblePersons } = useVisiblePersons();
  const requestFocus = useFamilyStore(s => s.requestFocus);
  const [query, setQuery] = useState('');

  const chusuBase = getChusuBase(persons, viewpointPersonId);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return visiblePersons
      .filter(p => !q || p.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [query, visiblePersons]);

  const handleClick = (personId: string) => {
    const branches = classifyBranch(personId, persons, relationships);
    requestFocus(personId, branches[0] ?? '친가');
    onClose();
  };

  return (
    <div className="search-backdrop" onClick={onClose}>
      <div className="search-panel" onClick={e => e.stopPropagation()}>
        <div className="search-header">
          <input
            className="search-input"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="이름으로 검색..."
            autoFocus
          />
          <button className="search-close" onClick={onClose}>✕</button>
        </div>

        <div className="search-count">
          {query.trim() ? `"${query}" 검색 결과 ${results.length}명` : `전체 ${results.length}명`}
        </div>

        <div className="search-list">
          {results.map(p => {
            const branches = classifyBranch(p.id, persons, relationships);
            const chusu = chusuBase ? getChusu(p.id, chusuBase, relationships) : null;
            const relationLabel = chusuBase ? getRelationLabel(p.id, chusuBase, persons, relationships) : '';
            const chusuLabel = relationLabel || (chusu != null ? `${chusu}촌` : '');

            return (
              <div
                key={p.id}
                className={`search-item ${branches.length === 0 ? 'unclassified' : ''}`}
                onClick={() => branches.length > 0 ? handleClick(p.id) : undefined}
              >
                <div className={`search-hex ${p.gender === 'male' ? 'male' : 'female'} ${p.is_root ? 'root' : ''} ${p.is_deceased ? 'deceased' : ''}`}>
                  {p.name[0]}
                </div>
                <div className="search-info">
                  <span className="search-name">
                    {p.name}
                    {chusuLabel && <span className="search-chusu">{chusuLabel}</span>}
                  </span>
                  <span className="search-meta">
                    {p.gender === 'male' ? '남' : p.gender === 'female' ? '여' : '?'}
                    {p.birth_date && ` · ${p.birth_date.substring(0, 4)}년생`}
                    {p.is_deceased && ' · 고인'}
                  </span>
                </div>
                <div className="search-branches">
                  {branches.length > 0
                    ? branches.map(b => <span key={b} className="branch-tag">{b}</span>)
                    : <span className="branch-tag unclassified-tag">분류없음</span>}
                </div>
              </div>
            );
          })}
          {results.length === 0 && (
            <p className="search-empty">'{query}' 검색 결과가 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
