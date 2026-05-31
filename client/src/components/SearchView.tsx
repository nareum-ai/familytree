import { useMemo, useState } from 'react';
import { useFamilyStore } from '../store/familyStore';
import { classifyBranch, getChusu } from '../hooks/useTreeLayout';
import { getRelationLabel } from '../utils/relationLabel';
import type { BranchType } from '../types';
import './SearchView.css';

interface Props {
  onClose: () => void;
}

export function SearchView({ onClose }: Props) {
  const { persons, relationships, viewpointPersonId, requestFocus } = useFamilyStore();
  const [query, setQuery] = useState('');

  const root     = persons.find(p => p.is_root === 1);
  const chusuBase = (viewpointPersonId ? persons.find(p => p.id === viewpointPersonId) : null) ?? root;

  // AnniversaryView와 동일: 접근 가능한 브랜치에 속한 사람만 표시
  const accessibleBranches = useMemo((): BranchType[] => {
    const viewpoint = viewpointPersonId ? persons.find(p => p.id === viewpointPersonId) : null;
    if (!root || !viewpoint || viewpoint.id === root.id) return ['친가', '외가', '처가', '처외가'];
    const hasSpouse = relationships.some(
      r => r.type === 'spouse' && (r.person1_id === viewpoint.id || r.person2_id === viewpoint.id)
    );
    return hasSpouse ? ['친가', '외가', '처가', '처외가'] : ['친가', '외가'];
  }, [persons, relationships, viewpointPersonId, root]);

  const visiblePersons = useMemo(() =>
    persons.filter(p => {
      const branches = classifyBranch(p.id, persons, relationships);
      return branches.some(b => (accessibleBranches as string[]).includes(b));
    }),
  [persons, relationships, accessibleBranches]);

  const results = useMemo(() => {
    const base = visiblePersons;
    if (!query.trim()) return base.slice().sort((a, b) => a.name.localeCompare(b.name));
    const q = query.trim().toLowerCase();
    return base
      .filter(p => p.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [query, visiblePersons]);

  const handleClick = (personId: string) => {
    const branches = classifyBranch(personId, persons, relationships);
    const targetBranch = (branches[0] as BranchType) ?? '친가';
    requestFocus(personId, targetBranch);
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
            const branchLabels = branches.map(b => {
              const map: Record<BranchType, string> = { '친가': '친가', '외가': '외가', '처가': '처가', '처외가': '처외가' };
              return map[b] ?? b;
            });

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
                  {branchLabels.length > 0
                    ? branchLabels.map(b => <span key={b} className="branch-tag">{b}</span>)
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
