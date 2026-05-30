import { useEffect, useMemo, useState } from 'react';
import { useFamilyStore } from '../store/familyStore';
import { classifyBranch, canSeeFull } from '../hooks/useTreeLayout';
import { buildAnniversaries, formatDate, type AnniversaryItem } from '../utils/anniversary';
import type { BranchType } from '../types';
import './AnniversaryView.css';

interface Props {
  onClose: () => void;
}

function DayChip({ days }: { days: number }) {
  if (days === 0) return <span className="day-chip today">오늘</span>;
  if (days <= 7)  return <span className="day-chip soon">D-{days}</span>;
  if (days <= 30) return <span className="day-chip near">D-{days}</span>;
  return <span className="day-chip far">D-{days}</span>;
}

function AnniversaryRow({
  item, onClick,
}: {
  item: AnniversaryItem;
  onClick: () => void;
}) {
  const dateLabel = `${formatDate(item.nextSolarDate)}${item.isLunar ? ' (음력)' : ''}`;
  const countLabel = item.type === '생일'
    ? `만 ${item.count}세`
    : `${item.count}주기`;
  // 2촌 이하: 관계명(아버지/할머니/형 등), 3촌+: N촌
  const chusuLabel = item.relationLabel
    ?? (item.chusu != null ? `${item.chusu}촌` : '');

  return (
    <div
      className={`ann-row clickable ${item.type === '기일' ? 'memorial' : ''}`}
      onClick={onClick}
    >
      <DayChip days={item.daysUntil} />
      <div className="ann-info">
        <span className="ann-name">{item.personName}</span>
        {chusuLabel && <span className="ann-chusu">{chusuLabel}</span>}
        <span className={`ann-type ${item.type === '기일' ? 'memorial' : 'birthday'}`}>
          {item.type}
        </span>
      </div>
      <div className="ann-date">
        <span>{dateLabel}</span>
        <span className="ann-count">{countLabel}</span>
      </div>
    </div>
  );
}

export function AnniversaryView({ onClose }: Props) {
  const { persons, relationships, viewpointPersonId, requestFocus, grantedPersonIds } = useFamilyStore();
  const root       = persons.find(p => p.is_root === 1);
  const mePersonId = viewpointPersonId ?? root?.id;
  const currentUserName = localStorage.getItem('familyTreeAccountName')
    ?? localStorage.getItem('familyTreeUser');
  const [items, setItems] = useState<AnniversaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 뷰포인트 접근 가능 브랜치
  const accessibleBranches = useMemo((): BranchType[] => {
    const root = persons.find(p => p.is_root === 1);
    const viewpoint = viewpointPersonId ? persons.find(p => p.id === viewpointPersonId) : null;
    if (!root || !viewpoint || viewpoint.id === root.id) return ['친가', '외가', '처가', '처외가'];
    const hasSpouse = relationships.some(
      r => r.type === 'spouse' &&
        (r.person1_id === viewpoint.id || r.person2_id === viewpoint.id)
    );
    return hasSpouse ? ['친가', '외가', '처가', '처외가'] : ['친가', '외가'];
  }, [persons, relationships, viewpointPersonId]);

  // 볼 수 있는 사람만
  const visiblePersons = useMemo(() =>
    persons.filter(p => {
      const branches = classifyBranch(p.id, persons, relationships);
      if (!branches.some(b => (accessibleBranches as string[]).includes(b))) return false;
      // 비공개 노드는 기념일에서 제외
      return canSeeFull(p, currentUserName, viewpointPersonId, root, grantedPersonIds);
    }),
  [persons, relationships, accessibleBranches, currentUserName, viewpointPersonId, root, grantedPersonIds]);

  // 촌수 계산 기준: 뷰포인트 인물 (없으면 root)
  const chusuBasePerson = mePersonId ? persons.find(p => p.id === mePersonId) : root;

  useEffect(() => {
    setLoading(true);
    buildAnniversaries(visiblePersons, relationships, chusuBasePerson).then(result => {
      setItems(result);
      setLoading(false);
    });
  }, [visiblePersons, relationships, chusuBasePerson?.id]);

  // 항목 클릭 → 트리에서 포커스
  const handleClick = (item: AnniversaryItem) => {
    const branches = classifyBranch(item.personId, persons, relationships);
    const targetBranch =
      branches.find(b => (accessibleBranches as string[]).includes(b)) ??
      (branches[0] as BranchType);
    if (targetBranch) {
      requestFocus(item.personId, targetBranch);
      onClose();
    }
  };

  const upcoming = items.filter(i => i.daysUntil <= 90);
  const later    = items.filter(i => i.daysUntil > 90);

  return (
    <div className="ann-backdrop" onClick={onClose}>
      <div className="ann-panel" onClick={e => e.stopPropagation()}>
        <div className="ann-header">
          <h2>📅 다가오는 기념일</h2>
          <button className="ann-close" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <p className="ann-empty">불러오는 중...</p>
        ) : items.length === 0 ? (
          <p className="ann-empty">생년월일 또는 기일이 입력된 가족이 없습니다.</p>
        ) : (
          <div className="ann-list">
            {upcoming.length > 0 && (
              <>
                <div className="ann-section-label">90일 이내</div>
                {upcoming.map(item => (
                  <AnniversaryRow key={`${item.personId}-${item.type}`} item={item} onClick={() => handleClick(item)} />
                ))}
              </>
            )}
            {later.length > 0 && (
              <>
                <div className="ann-section-label">이후 ({later.length}건)</div>
                {later.map(item => (
                  <AnniversaryRow key={`${item.personId}-${item.type}`} item={item} onClick={() => handleClick(item)} />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
