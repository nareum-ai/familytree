import { useEffect, useState } from 'react';
import type { Person } from '../types';
import { useFamilyStore } from '../store/familyStore';
import { getChusu } from '../hooks/useTreeLayout';
import { getRelationLabel } from '../utils/relationLabel';
import { getManAge } from '../utils/age';
import { DateInput } from './DateInput';
import './PersonDetail.css';

interface Props {
  person: Person;
  onAddFamily: () => void;
  onClose: () => void;
}

export function PersonDetail({ person, onAddFamily, onClose }: Props) {
  const { persons, relationships, updatePerson, deletePerson, createInvite,
          isPersonMapped, loadInfoRequestsForMe, approveInfoRequest, rejectInfoRequest } = useFamilyStore();
  const root = persons.find(p => p.is_root === 1)!;

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
  const [birthDate, setBirthDate] = useState(person.birth_date ?? '');
  const [birthLunar, setBirthLunar] = useState(person.birth_lunar ?? false);
  const [isDeceased, setIsDeceased] = useState(person.is_deceased ?? false);
  const [deathDate, setDeathDate] = useState(person.death_date ?? '');
  const [deathLunar, setDeathLunar] = useState(person.death_lunar ?? false);
  const [saving, setSaving] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState('');

  const chusu = getChusu(person.id, root, relationships);

  const handleSave = async () => {
    setSaving(true);
    await updatePerson(person.id, {
      name,
      birth_date: birthDate || null,
      birth_lunar: birthLunar,
      is_deceased: isDeceased,
      death_date: isDeceased && deathDate ? deathDate : null,
      death_lunar: isDeceased ? deathLunar : false,
    });
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
    setInviteLink(`${window.location.origin}/invite/${token}`);
  };

  const handleCopy = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopyMsg('복사됨!');
    setTimeout(() => setCopyMsg(''), 2000);
  };

  const genderLabel = person.gender === 'male' ? '남성' : person.gender === 'female' ? '여성' : '-';
  const { viewpointPersonId: vpId } = useFamilyStore();
  const mePersonId  = vpId ?? root?.id;
  const relationName = root ? getRelationLabel(person.id, root, persons, relationships) : '';

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

      {!editing ? (
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
          </div>
          <button className="btn-edit" onClick={() => setEditing(true)}>편집</button>
        </div>
      ) : (
        <div className="edit-form">
          <input value={name} onChange={e => setName(e.target.value)} className="edit-input" placeholder="이름" />

          <DateInput value={birthDate} onChange={setBirthDate}
            max={new Date().toISOString().split('T')[0]} />
          <label className="edit-lunar-check sub">
            <input type="checkbox" checked={birthLunar} onChange={e => setBirthLunar(e.target.checked)} />
            음력으로 입력
          </label>

          <label className="edit-deceased-check">
            <input type="checkbox" checked={isDeceased} onChange={e => setIsDeceased(e.target.checked)} />
            고인 (사망)
          </label>

          {isDeceased && (
            <>
              <DateInput value={deathDate} onChange={setDeathDate}
                max={new Date().toISOString().split('T')[0]} />
              <label className="edit-lunar-check sub">
                <input type="checkbox" checked={deathLunar} onChange={e => setDeathLunar(e.target.checked)} />
                음력으로 입력
              </label>
            </>
          )}

          <div className="edit-actions">
            <button onClick={() => setEditing(false)} className="btn-sm cancel">취소</button>
            <button onClick={handleSave} disabled={saving} className="btn-sm save">
              {saving ? '...' : '저장'}
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
          <p className="invite-label">초대 링크 (30일 유효)</p>
          <div className="invite-link-row">
            <input readOnly value={inviteLink} className="invite-input" />
            <button className="btn-copy" onClick={handleCopy}>{copyMsg || '복사'}</button>
          </div>
          <p className="invite-hint">이 링크로 들어오면 <strong>{person.name}</strong> 중심의 가계도가 열립니다</p>
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
    </div>
  );
}
