import { useEffect, useMemo, useState } from 'react';
import { useFamilyStore } from '../store/familyStore';
import { useVisiblePersons } from '../hooks/useVisiblePersons';
import { getMyPersonId } from '../lib/session';
import { buildInviteLink } from '../lib/inviteMessage';
import { getMappedPersonIds } from '../services/authService';
import { getChusu, getChusuBase } from '../utils/familyGraph';
import { getRelationLabel } from '../utils/relationLabel';
import { InviteLinkBox } from './InviteLinkBox';
import './SearchView.css';
import './InviteFamilyView.css';
import { Icon } from './Icon';

interface Props {
  onClose: () => void;
}

/** 아직 가입하지 않은 가족 목록 + 사람별 초대 링크 */
export function InviteFamilyView({ onClose }: Props) {
  const { persons, relationships, viewpointPersonId, visiblePersons } = useVisiblePersons();
  const currentFamilyId = useFamilyStore(s => s.currentFamilyId);
  const createInvite    = useFamilyStore(s => s.createInvite);

  const [mappedIds, setMappedIds] = useState<Set<string> | null>(null);
  const [openId, setOpenId]       = useState<string | null>(null);
  const [link, setLink]           = useState<string | null>(null);
  const [creating, setCreating]   = useState(false);

  useEffect(() => {
    getMappedPersonIds(currentFamilyId ?? 'main')
      .then(setMappedIds)
      .catch(() => setMappedIds(new Set()));
  }, [currentFamilyId]);

  const chusuBase = getChusuBase(persons, viewpointPersonId);
  const myPersonId = getMyPersonId();

  // 가까운 촌수 순 → 이름 순
  const { pending, joined } = useMemo(() => {
    const living = visiblePersons
      .filter(p => !p.is_deceased && p.id !== myPersonId)
      .map(p => ({
        person: p,
        chusu: chusuBase ? getChusu(p.id, chusuBase, relationships) : null,
        label: chusuBase ? getRelationLabel(p.id, chusuBase, persons, relationships) : '',
      }))
      .sort((a, b) => (a.chusu ?? 99) - (b.chusu ?? 99) || a.person.name.localeCompare(b.person.name));
    return {
      pending: living.filter(x => !mappedIds?.has(x.person.id)),
      joined:  living.filter(x => mappedIds?.has(x.person.id)),
    };
  }, [visiblePersons, myPersonId, chusuBase, relationships, persons, mappedIds]);

  const handleInvite = async (personId: string) => {
    if (openId === personId) { setOpenId(null); return; }
    setCreating(true);
    setOpenId(personId);
    setLink(null);
    try {
      setLink(buildInviteLink(await createInvite(personId)));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="search-backdrop" onClick={onClose}>
      <div className="search-panel" onClick={e => e.stopPropagation()}>
        <div className="search-header">
          <h2 className="invfam-title"><Icon name="mail" /> 가족 초대</h2>
          <button className="search-close" onClick={onClose}>✕</button>
        </div>

        <p className="invfam-desc">
          초대 링크는 사람마다 따로 만들어져요.<br />
          링크로 가입하면 가계도의 그 사람과 자동으로 연결됩니다.
        </p>

        <div className="search-list">
          {mappedIds === null ? (
            <p className="search-empty">불러오는 중...</p>
          ) : pending.length === 0 ? (
            <p className="search-empty invfam-empty">
              {joined.length > 0
                ? '모든 가족이 가입했어요'
                : '초대할 가족이 없어요.\n가계도에서 가족을 먼저 추가해 주세요.'}
            </p>
          ) : pending.map(({ person: p, chusu, label }) => (
            <div key={p.id} className="invfam-item">
              <div className="invfam-row">
                <div className={`search-hex ${p.gender === 'male' ? 'male' : 'female'}`}>{p.photo_url ? <span className="search-hex-inner"><img src={p.photo_url} alt="" /></span> : p.name[0]}</div>
                <div className="search-info">
                  <span className="search-name">
                    {p.name}
                    {(label || chusu != null) && <span className="search-chusu">{label || `${chusu}촌`}</span>}
                  </span>
                </div>
                <button
                  className={`invfam-btn ${openId === p.id ? 'active' : ''}`}
                  onClick={() => handleInvite(p.id)}
                  disabled={creating && openId !== p.id}
                >
                  {openId === p.id ? '닫기' : '초대'}
                </button>
              </div>
              {openId === p.id && (
                link
                  ? <InviteLinkBox link={link} personName={p.name} />
                  : <p className="invfam-creating">링크 만드는 중...</p>
              )}
            </div>
          ))}

          {joined.length > 0 && (
            <>
              <p className="invfam-section">이미 가입한 가족 {joined.length}명</p>
              {joined.map(({ person: p, chusu, label }) => (
                <div key={p.id} className="invfam-row joined">
                  <div className={`search-hex ${p.gender === 'male' ? 'male' : 'female'}`}>{p.photo_url ? <span className="search-hex-inner"><img src={p.photo_url} alt="" /></span> : p.name[0]}</div>
                  <div className="search-info">
                    <span className="search-name">
                      {p.name}
                      {(label || chusu != null) && <span className="search-chusu">{label || `${chusu}촌`}</span>}
                    </span>
                  </div>
                  <span className="invfam-joined">✓ 가입함</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
