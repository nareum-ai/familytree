import { useEffect, useState } from 'react';
import type { Person } from '../types';
import { useFamilyStore } from '../store/familyStore';
import { getChusu } from '../hooks/useTreeLayout';
import { getRelationLabel } from '../utils/relationLabel';
import { getManAge } from '../utils/age';
import { DateInput } from './DateInput';
import { AvatarPicker } from './AvatarPicker';
import { LS } from '../lib/storageKeys';
import './PersonDetail.css';

interface Props {
  person: Person;
  onAddFamily: () => void;
  onClose: () => void;
}

export function PersonDetail({ person, onAddFamily, onClose }: Props) {
  const { persons, relationships, viewpointPersonId, updatePerson, deletePerson, createInvite,
          isPersonMapped, loadInfoRequestsForMe, approveInfoRequest, rejectInfoRequest,
          updateRelationship } = useFamilyStore();
  const root       = persons.find(p => p.is_root === 1)!;
  const chusuBase  = (viewpointPersonId ? persons.find(p => p.id === viewpointPersonId) : null) ?? root;

  const [alreadyMapped, setAlreadyMapped] = useState(false);
  const [infoRequests, setInfoRequests]   = useState<Array<{ id: string; requesterName: string; personId: string; createdAt: string }>>([]);

  useEffect(() => {
    isPersonMapped(person.id)
      .then(setAlreadyMapped)
      .catch(() => {});

    loadInfoRequestsForMe()
      .then(reqs => setInfoRequests(reqs.filter(r => r.personId === person.id)))
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
  const [memo, setMemo]   = useState(person.memo ?? '');
  const [photoUrl, setPhotoUrl]     = useState(person.photo_url ?? '');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState('');

  const spouseRel = relationships.find(
    r => r.type === 'spouse' && (r.person1_id === person.id || r.person2_id === person.id)
  ) ?? null;
  const [marriageDate, setMarriageDate] = useState(spouseRel?.marriage_date ?? '');
  const [marriageLunar, setMarriageLunar] = useState(spouseRel?.marriage_lunar ?? false);

  const chusu = getChusu(person.id, chusuBase, relationships);

  const handleSave = async () => {
    setSaving(true);
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
      memo:  memo.trim()  || null,
      photo_url: photoUrl || null,
    });
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
    // 이 인물을 제거했을 때 root에서 단절되는 인물 탐색
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
        .filter((pid, i, arr) => arr.indexOf(pid) === i) // 중복 제거
        .filter(pid => pid !== root.id && !canReach(pid));

      if (orphaned.length > 0) {
        const names = orphaned
          .map(pid => persons.find(p => p.id === pid)?.name ?? '(알 수 없음)')
          .join(', ');
        alert(`${person.name}을(를) 삭제하면 ${names}이(가) 트리에서 연결이 끊깁니다.\n먼저 해당 인물들을 삭제해 주세요.`);
        return;
      }
    }

    if (!confirm(`${person.name}을(를) 삭제하시겠습니까?`)) return;
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

  const genderLabel = person.gender === 'male' ? '남성' : person.gender === 'female' ? '여성' : '-';
  const { viewpointPersonId: vpId } = useFamilyStore();
  const mePersonId  = vpId ?? root?.id;

  const currentUserAccount = localStorage.getItem('familyTreeAccountName') ?? localStorage.getItem('familyTreeUser');

  const myPersonId = localStorage.getItem(LS.MY_PERSON_ID);

  // 편집 권한: 나 자신 | 내가 만든 노드 | 관리자
  const isAdmin = localStorage.getItem(LS.IS_ADMIN) === 'true' || localStorage.getItem(LS.ADMIN_RETURN) === 'true';
  const canEdit = (() => {
    if (isAdmin) return true;
    if (person.id === vpId || person.id === myPersonId) return true;         // 내 노드
    if (person.created_by && person.created_by === currentUserAccount) return true; // 내가 만든 노드
    return false;
  })();
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
        <div className={`detail-hex ${person.gender === 'male' ? 'male' : 'female'} ${person.is_root ? 'root' : ''} ${person.is_deceased ? 'deceased' : ''}`}>
          {person.photo_url ? <img src={person.photo_url} alt={person.name} /> : <span>{person.name[0]}</span>}
        </div>
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
            {spouseRel?.marriage_date && (
              <span className="meta-chip marriage-chip">💍 {fmtDate(spouseRel.marriage_date, !!spouseRel.marriage_lunar)}</span>
            )}
            <span className="meta-chip accent">{chusuLabel}</span>
          </div>
          {(person.phone || person.email || person.memo) && (
            <div className="detail-contact">
              {person.phone && (
                <a className="contact-row" href={`tel:${person.phone}`}>
                  <span className="contact-icon">📱</span>{person.phone}
                </a>
              )}
              {person.email && (
                <a className="contact-row" href={`mailto:${person.email}`}>
                  <span className="contact-icon">📧</span>{person.email}
                </a>
              )}
              {person.memo && (
                <div className="contact-row contact-memo">
                  <span className="contact-icon">📝</span>{person.memo}
                </div>
              )}
            </div>
          )}
          {canEdit && (
            <button className="btn-edit" onClick={() => setEditing(true)}>편집</button>
          )}
        </div>
      ) : (
        <div className="edit-form">
          <div className="avatar-selector-wrap">
            <button type="button" className="avatar-selector-btn" onClick={() => setShowAvatarPicker(true)}>
              {photoUrl
                ? <img src={photoUrl} alt="아바타" className="avatar-preview" />
                : <span className="avatar-placeholder">{name[0] ?? '?'}</span>}
              <span className="avatar-edit-badge">✏️</span>
            </button>
            {photoUrl && (
              <button type="button" className="edit-avatar-remove-link" onClick={() => setPhotoUrl('')}>
                아바타 삭제
              </button>
            )}
          </div>

          <div className="form-field">
            <label>이름</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="이름" required />
          </div>

          <div className="form-field">
            <label>성별</label>
            <div className="gender-btns">
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
              <label>기타 사항</label>
              <textarea value={memo} onChange={e => setMemo(e.target.value)}
                className="edit-input edit-memo" placeholder="메모" rows={3} maxLength={200} />
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
          <span className="action-icon">+</span>가족 추가
        </button>
        {person.is_deceased ? null : alreadyMapped ? (
          <div className="action-mapped-notice">
            🔒 이미 계정에 연결된 인물입니다
          </div>
        ) : (
          <button className="action-btn secondary" onClick={handleInvite}>
            <span className="action-icon">🔗</span>초대 링크 만들기
          </button>
        )}
        {!person.is_root && !alreadyMapped && (
          <button className="action-btn danger" onClick={handleDelete}>삭제</button>
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
                    // requester_member_id 직접 조회
                    const { getDocs, collection, query, where } = await import('firebase/firestore');
                    const { db } = await import('../lib/firebase');
                    const snap = await getDocs(query(collection(db, 'info_requests'),
                      where('requester_name', '==', req.requesterName)));
                    const docData = snap.docs.find(d => d.id === req.id);
                    const requesterMemberId = docData?.data().requester_member_id ?? '';
                    await approveInfoRequest(req.id, requesterMemberId, req.personId);
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
    </div>
  );
}
