import { useEffect, useState } from 'react';
import type { Person, EditGrant } from '../types';
import { useFamilyStore } from '../store/familyStore';
import { getChusu } from '../hooks/useTreeLayout';
import { getRelationLabel } from '../utils/relationLabel';
import { getManAge } from '../utils/age';
import { DateInput } from './DateInput';
import { AvatarPicker } from './AvatarPicker';
import { LS, getCurrentUserName } from '../lib/storageKeys';
import { AddPetModal } from './AddPetModal';
import './PersonDetail.css';

interface Props {
  person: Person;
  onAddFamily: () => void;
  onClose: () => void;
}

export function PersonDetail({ person, onAddFamily, onClose }: Props) {
  const { persons, relationships, viewpointPersonId, updatePerson, deletePerson, createInvite,
          isPersonMapped, loadInfoRequestsForMe, approveInfoRequest, rejectInfoRequest,
          updateRelationship, addRelationship, selectPerson,
          editGrantedPersonIds, loadEditGrantsForPerson, grantEditAccess, revokeEditAccess } = useFamilyStore();
  const root       = persons.find(p => p.is_root === 1)!;
  const chusuBase  = (viewpointPersonId ? persons.find(p => p.id === viewpointPersonId) : null) ?? root;

  const [alreadyMapped, setAlreadyMapped] = useState(false);
  const [infoRequests, setInfoRequests]   = useState<Array<{ id: string; requesterName: string; personId: string; createdAt: string }>>([]);
  const [editGrants, setEditGrants] = useState<EditGrant[]>([]);
  const [showGrantPicker, setShowGrantPicker] = useState(false);
  const [granteeSearch, setGranteeSearch] = useState('');

  useEffect(() => {
    isPersonMapped(person.id)
      .then(setAlreadyMapped)
      .catch(() => {});

    loadInfoRequestsForMe()
      .then(reqs => setInfoRequests(reqs.filter(r => r.personId === person.id)))
      .catch(() => {});

    loadEditGrantsForPerson(person.id)
      .then(grants => {
        setEditGrants(grants);
        setShowGrantPicker(false);
        setGranteeSearch('');
      })
      .catch(() => {});
  }, [person.id]);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(person.name);
  const [gender, setGender] = useState<'male' | 'female'>(person.gender ?? 'male');
  const [birthDate, setBirthDate] = useState(person.birth_date ?? '');
  const [birthLunar, setBirthLunar] = useState(person.birth_lunar ?? false);
  const [isDeceased, setIsDeceased] = useState(person.is_deceased ?? false);
  const [deathDate, setDeathDate] = useState(person.death_date ?? '');
  const [deathLunar, setDeathLunar] = useState(person.death_lunar ?? false);
  const [phone, setPhone] = useState(person.phone ?? '');
  const [email, setEmail] = useState(person.email ?? '');
  const [recentStatusList, setRecentStatusList] = useState(person.recent_status ?? []);
  const [newStatusText, setNewStatusText] = useState('');
  const [photoUrl, setPhotoUrl]     = useState(person.photo_url ?? '');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showAddPetModal, setShowAddPetModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState('');

  const spouseRels = relationships.filter(
    r => r.type === 'spouse' && (r.person1_id === person.id || r.person2_id === person.id)
  );
  const primarySpouseRel = spouseRels.find(r => r.is_primary === true) ?? spouseRels[0] ?? null;
  const spouseRel = primarySpouseRel;
  const [marriageDate, setMarriageDate] = useState(spouseRel?.marriage_date ?? '');
  const [marriageLunar, setMarriageLunar] = useState(spouseRel?.marriage_lunar ?? false);

  const chusu = getChusu(person.id, chusuBase, relationships);

  const handleSetPrimary = async (relId: string) => {
    await Promise.all(
      spouseRels.map(r =>
        updateRelationship(r.id, { is_primary: r.id === relId })
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    let finalStatusList = recentStatusList;
    const newText = newStatusText.trim();
    if (newText) {
      finalStatusList = [{ text: newText, at: new Date().toISOString().split('T')[0] }, ...recentStatusList].slice(0, 3);
    }
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
    setRecentStatusList(finalStatusList);
    setNewStatusText('');
    if (spouseRel) {
      await updateRelationship(spouseRel.id, {
        marriage_date: marriageDate || null,
        marriage_lunar: marriageLunar,
      });
    }
    setSaving(false);
    setEditing(false);
  };

  const handleDelete = async () => {
    const deletingSpouseId = spouseRel
      ? (spouseRel.person1_id === person.id ? spouseRel.person2_id : spouseRel.person1_id)
      : null;

    const root = persons.find(p => p.is_root === 1);
    if (root) {
      const filteredRels = relationships.filter(
        r => r.person1_id !== person.id && r.person2_id !== person.id
      );
      const canReach = (startId: string): boolean => {
        const visited = new Set<string>();
        const q = [startId];
        while (q.length) {
          const cur = q.shift()!;
          if (cur === root.id) return true;
          if (visited.has(cur)) continue;
          visited.add(cur);
          filteredRels
            .filter(r => r.person1_id === cur || r.person2_id === cur)
            .forEach(r => q.push(r.person1_id === cur ? r.person2_id : r.person1_id));
        }
        return false;
      };
      const orphaned = relationships
        .filter(r => r.person1_id === person.id || r.person2_id === person.id)
        .map(r => r.person1_id === person.id ? r.person2_id : r.person1_id)
        .filter((pid, i, arr) => arr.indexOf(pid) === i)
        .filter(pid => {
          if (pid === root.id) return false;
          if (canReach(pid)) return false;
          // 배우자가 root에 연결돼 있고, 이 인물이 삭제 대상의 자녀면 고아 아님
          if (deletingSpouseId && canReach(deletingSpouseId)) {
            const isChild = relationships.some(
              r => r.type === 'parent_child' && r.person1_id === person.id && r.person2_id === pid
            );
            if (isChild) return false;
          }
          return true;
        });

      if (orphaned.length > 0) {
        const names = orphaned
          .map(pid => persons.find(p => p.id === pid)?.name ?? '(알 수 없음)')
          .join(', ');
        alert(`${person.name}을(를) 삭제하면 ${names}이(가) 트리에서 연결이 끊깁니다.\n먼저 해당 인물들을 삭제해 주세요.`);
        return;
      }
    }

    if (!confirm(`${person.name}을(를) 삭제하시겠습니까?`)) return;

    // 배우자가 있으면, 삭제 전에 나의 자녀를 배우자에게도 연결
    if (deletingSpouseId) {
      const myChildren = relationships
        .filter(r => r.type === 'parent_child' && r.person1_id === person.id)
        .map(r => r.person2_id);
      for (const childId of myChildren) {
        const alreadyLinked = relationships.some(
          r => r.type === 'parent_child' && r.person1_id === deletingSpouseId && r.person2_id === childId
        );
        if (!alreadyLinked) {
          await addRelationship({ person1_id: deletingSpouseId, person2_id: childId, type: 'parent_child' });
        }
      }
    }

    await deletePerson(person.id);
    onClose();
  };

  const handleInvite = async () => {
    const token = await createInvite(person.id);
    const senderName = localStorage.getItem('familyTreeUser') ?? '';
    const base = `${window.location.origin}/invite/${token}`;
    setInviteLink(senderName ? `${base}?from=${encodeURIComponent(senderName)}` : base);
  };

  const handleCopy = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopyMsg('복사됨!');
    setTimeout(() => setCopyMsg(''), 2000);
  };

  const handleWebShare = async () => {
    if (!inviteLink) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: '가족 가계도 초대', text: '이 링크를 눌러 가입해야 본인의 가계도를 즉시 볼 수 있습니다.', url: inviteLink });
      } catch { /* 취소 */ }
    } else {
      handleCopy();
    }
  };

  const handleSMSShare = () => {
    if (!inviteLink) return;
    const body = encodeURIComponent(`이 링크를 눌러 가입해야 본인의 가계도를 즉시 볼 수 있습니다.\n${inviteLink}`);
    window.open(`sms:?body=${body}`);
  };

  const buildInviteLink = async () => {
    const token = await createInvite(person.id);
    const senderName = localStorage.getItem('familyTreeUser') ?? '';
    const base = `${window.location.origin}/invite/${token}`;
    return senderName ? `${base}?from=${encodeURIComponent(senderName)}` : base;
  };

  const handleDirectSMSInvite = async () => {
    const link = await buildInviteLink();
    const body = encodeURIComponent(`이 링크를 눌러 가입하면 ${person.name}으로 바로 가족 가계도에 등록됩니다.\n${link}`);
    window.open(`sms:${person.phone ?? ''}?body=${body}`);
  };

  const handleDirectEmailInvite = async () => {
    const link = await buildInviteLink();
    const subject = encodeURIComponent('가족 가계도 초대');
    const body = encodeURIComponent(`이 링크를 눌러 가입하면 ${person.name}으로 바로 가족 가계도에 등록됩니다.\n${link}`);
    window.open(`mailto:${person.email ?? ''}?subject=${subject}&body=${body}`);
  };

  const genderLabel = person.gender === 'male' ? '남성' : person.gender === 'female' ? '여성' : '-';
  const { viewpointPersonId: vpId } = useFamilyStore();
  const mePersonId  = vpId ?? root?.id;

  const currentUserAccount = getCurrentUserName();

  const myPersonId = localStorage.getItem(LS.MY_PERSON_ID);

  // 편집 권한 소유자: 나 자신 | 관리자 | (주인 없는 노드만) 내가 만든 노드
  const isAdmin = localStorage.getItem(LS.IS_ADMIN) === 'true' || localStorage.getItem(LS.ADMIN_RETURN) === 'true';
  const isOwnerOrCreator = (() => {
    if (isAdmin) return true;
    if (person.id === vpId || person.id === myPersonId) return true;         // 내 노드
    if (alreadyMapped) return false;                                          // 주인 있는 노드는 본인만
    if (person.created_by && person.created_by === currentUserAccount) return true; // 내가 만든 노드 (주인 없을 때만)
    return false;
  })();
  // 위임받은 편집 권한이 있으면 편집은 가능하되, 추가 위임(부여/회수)은 원 소유자만 가능
  const canEdit = isOwnerOrCreator || editGrantedPersonIds.has(person.id);
  const canManageEditGrants = isOwnerOrCreator;
  const relationName = chusuBase ? getRelationLabel(person.id, chusuBase, persons, relationships) : '';

  // 촌수 배지: 0촌이면 나/배우자, 그 외엔 "N촌 (관계명)"
  const chusuLabel = chusu === 0
    ? (person.id === mePersonId ? '나' : '배우자')
    : chusu
      ? (relationName ? `${chusu}촌 (${relationName})` : `${chusu}촌`)
      : '-';
  const manAge = person.birth_date ? getManAge(person.birth_date) : null;

  const fmtDate = (d: string | null, lunar: boolean) => {
    if (!d) return null;
    return `${d.replace(/-/g, '.')}${lunar ? ' (음력)' : ''}`;
  };

  return (
    <div className="detail-panel">
      <div className="detail-header">
        {!editing && (
          <div className={`detail-hex ${person.gender === 'male' ? 'male' : 'female'} ${person.is_root ? 'root' : ''} ${person.is_deceased ? 'deceased' : ''}`}>
            {person.photo_url ? <img src={person.photo_url} alt={person.name} /> : <span>{person.name[0]}</span>}
          </div>
        )}
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      {!editing || !canEdit ? (
        <div className="detail-info">
          <h2 className="detail-name">
            {person.is_deceased && <span className="deceased-mark">†</span>}
            {person.name}
          </h2>
          <div className="detail-meta">
            <span className="meta-chip">{genderLabel}</span>
            {manAge !== null && <span className="meta-chip">만 {manAge}세</span>}
            {fmtDate(person.birth_date, person.birth_lunar) && (
              <span className="meta-chip">{fmtDate(person.birth_date, person.birth_lunar)}생</span>
            )}
            {person.is_deceased && fmtDate(person.death_date, person.death_lunar) && (
              <span className="meta-chip deceased-chip">기일 {fmtDate(person.death_date, person.death_lunar)}</span>
            )}
            <span className="meta-chip accent">{chusuLabel}</span>
            {spouseRels.map(r => {
              const spId = r.person1_id === person.id ? r.person2_id : r.person1_id;
              const sp = persons.find(p => p.id === spId);
              if (!sp) return null;
              const isPrimary = r.is_primary === true || (spouseRels.length === 1);
              return (
                <span key={r.id} className={`meta-chip marriage-chip ${isPrimary ? 'marriage-primary' : 'marriage-secondary'}`}>
                  💍 {sp.name}
                  {r.marriage_date && <span className="marriage-date">({fmtDate(r.marriage_date, !!r.marriage_lunar)})</span>}
                  {canEdit && spouseRels.length > 1 && !isPrimary && (
                    <button className="btn-set-primary" onClick={() => handleSetPrimary(r.id)}>대표 지정</button>
                  )}
                </span>
              );
            })}
          </div>
          {person.recent_status && person.recent_status.length > 0 && (
            <div className="detail-recent-status">
              <div className="recent-status-head">
                <span className="contact-icon">💬</span>
                <span className="recent-status-label">근황</span>
              </div>
              {person.recent_status.map((s, i) => (
                <div key={i} className="recent-status-entry">
                  <div className="recent-status-body">{s.text}</div>
                  <span className="recent-status-date">{fmtDate(s.at, false)}</span>
                </div>
              ))}
            </div>
          )}
          {(person.phone || person.email) && (
            <div className="detail-contact">
              {person.phone && (
                <div className="contact-row-wrap">
                  <a className="contact-row" href={`tel:${person.phone}`}>
                    <span className="contact-icon">📱</span>{person.phone}
                  </a>
                  {!alreadyMapped && !person.is_deceased && (
                    <button className="btn-contact-invite" onClick={handleDirectSMSInvite}>SMS 초대</button>
                  )}
                </div>
              )}
              {person.email && (
                <div className="contact-row-wrap">
                  <a className="contact-row" href={`mailto:${person.email}`}>
                    <span className="contact-icon">📧</span>{person.email}
                  </a>
                  {!alreadyMapped && !person.is_deceased && (
                    <button className="btn-contact-invite email" onClick={handleDirectEmailInvite}>이메일 초대</button>
                  )}
                </div>
              )}
            </div>
          )}
          {!person.is_pet && (
            <div className="detail-meta">
              {persons.filter(p => p.is_pet && p.owner_person_id === person.id).map(pet => (
                <span key={pet.id} className="meta-chip" style={{ cursor: 'pointer' }} onClick={() => selectPerson(pet.id)}>
                  🐾 {pet.name}
                </span>
              ))}
              {canEdit && (
                <button className="meta-chip" style={{ cursor: 'pointer' }} onClick={() => setShowAddPetModal(true)}>
                  + 반려동물 추가
                </button>
              )}
            </div>
          )}
          {canEdit && (
            <div className="detail-btn-row">
              <button className="btn-edit" onClick={() => setEditing(true)}>편집</button>
              {!person.is_root && !alreadyMapped && (
                <button className="btn-delete-sm" onClick={handleDelete}>삭제</button>
              )}
            </div>
          )}

          {canManageEditGrants && (
            <div className="edit-grant-section">
              <p className="edit-grant-title">✏️ 편집 권한 관리</p>
              {editGrants.length > 0 && (
                <div className="detail-meta">
                  {editGrants.map(g => (
                    <span key={g.id} className="meta-chip">
                      {g.grantee_name}
                      <button
                        type="button"
                        className="edit-grant-revoke-btn"
                        onClick={async () => {
                          await revokeEditAccess(g.id, g.person_id, g.grantee_person_id);
                          setEditGrants(list => list.filter(x => x.id !== g.id));
                        }}
                      >✕</button>
                    </span>
                  ))}
                </div>
              )}
              {showGrantPicker ? (
                <div className="edit-grant-picker">
                  <input
                    className="edit-grant-search-input"
                    value={granteeSearch}
                    onChange={e => setGranteeSearch(e.target.value)}
                    placeholder="이름으로 검색"
                    autoFocus
                  />
                  {granteeSearch.trim() && (
                    <div className="edit-grant-results">
                      {persons
                        .filter(p => !p.is_pet && p.id !== person.id
                          && !editGrants.some(g => g.grantee_person_id === p.id)
                          && p.name.includes(granteeSearch.trim()))
                        .slice(0, 8)
                        .map(p => (
                          <div
                            key={p.id}
                            className="edit-grant-result-row"
                            onClick={async () => {
                              await grantEditAccess(person.id, p.id, p.name);
                              setEditGrants(await loadEditGrantsForPerson(person.id));
                              setShowGrantPicker(false);
                              setGranteeSearch('');
                            }}
                          >
                            {p.name}
                          </div>
                        ))}
                    </div>
                  )}
                  <button type="button" className="edit-grant-cancel-btn"
                    onClick={() => { setShowGrantPicker(false); setGranteeSearch(''); }}>취소</button>
                </div>
              ) : (
                <button type="button" className="meta-chip" style={{ cursor: 'pointer' }} onClick={() => setShowGrantPicker(true)}>
                  + 추가
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="edit-form">
          <div className="avatar-selector-wrap">
            <button type="button" className="avatar-selector-btn" onClick={() => setShowAvatarPicker(true)}>
              {photoUrl
                ? <img src={photoUrl} alt="아바타" className="avatar-preview" />
                : <span className={`avatar-initial-circle ${gender === 'female' ? 'female' : 'male'}`}>
                    {name[0] || '?'}
                  </span>}
            </button>
            <span className="avatar-selector-label">아바타 설정</span>
            {photoUrl && (
              <button type="button" className="edit-avatar-remove-link" onClick={() => setPhotoUrl('')}>
                아바타 삭제
              </button>
            )}
          </div>

          <div className="form-field name-gender-row">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="이름" required />
            <div className="gender-btns-inline">
              <button type="button" className={`gender-btn ${gender === 'male' ? 'active male' : ''}`}
                onClick={() => setGender('male')}>남</button>
              <button type="button" className={`gender-btn ${gender === 'female' ? 'active female' : ''}`}
                onClick={() => setGender('female')}>여</button>
            </div>
          </div>

          <div className="form-field">
            <label>생년월일 (선택)</label>
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
              고인 (사망)
            </label>
          </div>

          {isDeceased && (
            <div className="form-field">
              <label>기일 / 사망일 (선택)</label>
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

          {spouseRel && (
            <div className="form-field">
              <label>💍 결혼기념일 (선택)</label>
              <div className="date-row">
                <DateInput value={marriageDate} onChange={setMarriageDate}
                  max={new Date().toISOString().split('T')[0]} />
                <label className="lunar-check">
                  <input type="checkbox" checked={marriageLunar} onChange={e => setMarriageLunar(e.target.checked)} />
                  음력
                </label>
              </div>
            </div>
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
              <label>근황 <span className="recent-status-hint">(최근 3개만 유지)</span></label>
              {recentStatusList.length > 0 && (
                <div className="recent-status-edit-list">
                  {recentStatusList.map((s, i) => (
                    <div key={i} className="recent-status-edit-entry">
                      <div className="recent-status-edit-text">{s.text}</div>
                      <span className="recent-status-edit-date">{fmtDate(s.at, false)}</span>
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
            <button type="button" onClick={() => setEditing(false)} className="btn-cancel">취소</button>
            <button type="button" onClick={handleSave} disabled={saving || !name.trim()} className="btn-save">
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}

      <div className="detail-actions">
        <button className="action-btn primary" onClick={onAddFamily}>
          <span className="action-icon">+</span>{person.name}의 가족 추가하기
        </button>
        {person.is_deceased ? null : alreadyMapped ? (
          <div className="action-mapped-notice">
            🔒 이미 계정에 연결된 인물입니다
          </div>
        ) : (
          <button className="action-btn secondary" onClick={handleInvite}>
            <span className="action-icon">🔗</span>{person.name} 님을 가계도로 초대하기
          </button>
        )}
      </div>

      {inviteLink && (
        <div className="invite-box">
          <p className="invite-label">🔗 초대 링크 생성됨 <span className="invite-expiry">30일 유효</span></p>
          <div className="invite-desc-block">
            <p className="invite-desc-main">
              이 링크로 가입하면<br/>
              <strong className="invite-name-highlight">{person.name}</strong>
              <span className="invite-desc-sub">으로 바로 가입됩니다</span>
            </p>
          </div>
          <div className="invite-link-row">
            <input readOnly value={inviteLink} className="invite-input" />
            <button className="btn-copy" onClick={handleCopy}>{copyMsg || '복사'}</button>
          </div>
          <div className="invite-share-row">
            <button className="invite-share-btn kakao" onClick={handleWebShare}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 1.5C4.86 1.5 1.5 4.08 1.5 7.26c0 2.04 1.35 3.84 3.39 4.86l-.87 3.24 3.78-2.49c.39.06.78.09 1.2.09 4.14 0 7.5-2.58 7.5-5.76S13.14 1.5 9 1.5z" fill="currentColor"/>
              </svg>
              카카오톡
            </button>
            <button className="invite-share-btn sms" onClick={handleSMSShare}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              문자
            </button>
          </div>
        </div>
      )}

      {infoRequests.length > 0 && (
        <div className="info-req-section">
          <p className="info-req-title">📬 정보공개 요청 ({infoRequests.length}건)</p>
          {infoRequests.map(req => (
            <div key={req.id} className="info-req-row">
              <span className="info-req-name">{req.requesterName}님</span>
              <div className="info-req-btns">
                <button
                  className="info-req-approve"
                  onClick={async () => {
                    await approveInfoRequest(req.id, req.requesterName, req.personId);
                    setInfoRequests(r => r.filter(x => x.id !== req.id));
                  }}
                >수락</button>
                <button
                  className="info-req-reject"
                  onClick={async () => {
                    await rejectInfoRequest(req.id);
                    setInfoRequests(r => r.filter(x => x.id !== req.id));
                  }}
                >거절</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAvatarPicker && (
        <AvatarPicker
          current={photoUrl || null}
          onSelect={url => setPhotoUrl(url ?? '')}
          onClose={() => setShowAvatarPicker(false)}
        />
      )}

      {showAddPetModal && (
        <AddPetModal
          targetPerson={person}
          onClose={() => setShowAddPetModal(false)}
          onDone={() => setShowAddPetModal(false)}
        />
      )}
    </div>
  );
}
