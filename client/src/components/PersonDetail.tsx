import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Person } from '../types';
import { useFamilyStore, type InfoRequestItem } from '../store/familyStore';
import { findOrphansOnDelete, findRoot, getChusu, getChusuBase } from '../utils/familyGraph';
import { getRelationLabel } from '../utils/relationLabel';
import { getManAge } from '../utils/age';
import { formatDotDate } from '../utils/date';
import { getCurrentUserName } from '../lib/storageKeys';
import { getMyPersonId, isAdminContext } from '../lib/session';
import { isPersonMapped } from '../services/authService';
import { PersonEditForm } from './PersonEditForm';
import { EditGrantSection } from './EditGrantSection';
import { InviteLinkBox } from './InviteLinkBox';
import { buildInviteLink, buildInviteMessage } from '../lib/inviteMessage';
import './PersonDetail.css';
import { Icon } from './Icon';

interface Props {
  person: Person;
  onAddFamily: () => void;
  onClose: () => void;
}

export function PersonDetail({ person, onAddFamily, onClose }: Props) {
  const { persons, relationships, viewpointPersonId, editGrantedPersonIds, tempUnlockAll } = useFamilyStore(
    useShallow(s => ({
      persons: s.persons, relationships: s.relationships, viewpointPersonId: s.viewpointPersonId,
      editGrantedPersonIds: s.editGrantedPersonIds, tempUnlockAll: s.tempUnlockAll,
    }))
  );
  const myMemos = useFamilyStore(s => s.memos[person.id]);
  const { deletePerson, createInvite, loadInfoRequestsForMe, approveInfoRequest, rejectInfoRequest,
          updateRelationship, addRelationship } = useFamilyStore.getState();

  const [alreadyMapped, setAlreadyMapped] = useState(false);
  const [infoRequests, setInfoRequests]   = useState<InfoRequestItem[]>([]);
  const [showGrantSection, setShowGrantSection] = useState(false);
  const [editing, setEditing] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  useEffect(() => {
    isPersonMapped(person.id, person.family_id).then(setAlreadyMapped).catch(() => {});
    loadInfoRequestsForMe()
      .then(reqs => setInfoRequests(reqs.filter(r => r.personId === person.id)))
      .catch(() => {});
  }, [person.id, loadInfoRequestsForMe]);

  const root      = findRoot(persons);
  const chusuBase = getChusuBase(persons, viewpointPersonId);
  const mePersonId = viewpointPersonId ?? root?.id;

  const spouseRels = relationships.filter(
    r => r.type === 'spouse' && (r.person1_id === person.id || r.person2_id === person.id)
  );
  const spouseRel = spouseRels.find(r => r.is_primary === true) ?? spouseRels[0] ?? null;
  const spouseIdOf = (r: { person1_id: string; person2_id: string }) =>
    r.person1_id === person.id ? r.person2_id : r.person1_id;

  // 편집 권한 소유자: 나 자신 | 관리자 | (주인 없는 노드만) 내가 만든 노드
  const myPersonId = getMyPersonId();
  const isOwnerOrCreator =
    isAdminContext() ||
    person.id === viewpointPersonId || person.id === myPersonId ||           // 내 노드
    (!alreadyMapped && !!person.created_by && person.created_by === getCurrentUserName()); // 주인 없는 내가 만든 노드
  // 위임받은 편집 권한이 있으면 편집은 가능하되, 추가 위임(부여/회수)은 원 소유자만 가능
  const canEdit = isOwnerOrCreator || editGrantedPersonIds.has(person.id) || tempUnlockAll;
  const canManageEditGrants = isOwnerOrCreator;

  const handleSetPrimary = async (relId: string) => {
    await Promise.all(spouseRels.map(r => updateRelationship(r.id, { is_primary: r.id === relId })));
  };

  const handleDelete = async () => {
    const deletingSpouseId = spouseRel ? spouseIdOf(spouseRel) : null;

    const orphaned = findOrphansOnDelete(person, persons, relationships, deletingSpouseId);
    if (orphaned.length > 0) {
      const names = orphaned
        .map(pid => persons.find(p => p.id === pid)?.name ?? '(알 수 없음)')
        .join(', ');
      alert(`${person.name}을(를) 삭제하면 ${names}이(가) 트리에서 연결이 끊깁니다.\n먼저 해당 인물들을 삭제해 주세요.`);
      return;
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

  const makeInviteLink = async () => buildInviteLink(await createInvite(person.id));

  const handleInvite = async () => setInviteLink(await makeInviteLink());

  const directInviteBody = (link: string) =>
    encodeURIComponent(`${buildInviteMessage(person.name)}\n${link}`);

  const handleDirectSMSInvite = async () => {
    const link = await makeInviteLink();
    window.open(`sms:${person.phone ?? ''}?body=${directInviteBody(link)}`);
  };

  const handleDirectEmailInvite = async () => {
    const link = await makeInviteLink();
    const subject = encodeURIComponent('가족 가계도 초대');
    window.open(`mailto:${person.email ?? ''}?subject=${subject}&body=${directInviteBody(link)}`);
  };

  const removeInfoRequest = (id: string) => setInfoRequests(r => r.filter(x => x.id !== id));

  const genderLabel = person.gender === 'male' ? '남성' : person.gender === 'female' ? '여성' : '-';
  const chusu = chusuBase ? getChusu(person.id, chusuBase, relationships) : null;
  const relationName = chusuBase ? getRelationLabel(person.id, chusuBase, persons, relationships) : '';

  // 촌수 배지: 0촌이면 나/배우자, 그 외엔 "N촌 (관계명)"
  const chusuLabel = chusu === 0
    ? (person.id === mePersonId ? '나' : '배우자')
    : chusu
      ? (relationName ? `${chusu}촌 (${relationName})` : `${chusu}촌`)
      : '-';
  const manAge = person.birth_date ? getManAge(person.birth_date) : null;
  const birthLabel = formatDotDate(person.birth_date, person.birth_lunar);
  const deathLabel = formatDotDate(person.death_date, person.death_lunar);
  const canInvite = !alreadyMapped && !person.is_deceased;

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

      {editing && canEdit ? (
        <PersonEditForm person={person} spouseRel={spouseRel} onDone={() => setEditing(false)} />
      ) : (
        <div className="detail-info">
          <h2 className="detail-name">
            {person.is_deceased && <span className="deceased-mark">†</span>}
            {person.name}
          </h2>
          <div className="detail-meta">
            <span className="meta-chip">{genderLabel}</span>
            {manAge !== null && <span className="meta-chip">만 {manAge}세</span>}
            {birthLabel && <span className="meta-chip">{birthLabel}생</span>}
            {person.is_deceased && deathLabel && (
              <span className="meta-chip deceased-chip">기일 {deathLabel}</span>
            )}
            <span className="meta-chip accent">{chusuLabel}</span>
            {spouseRels.map(r => {
              const sp = persons.find(p => p.id === spouseIdOf(r));
              if (!sp) return null;
              const isPrimary = r.is_primary === true || spouseRels.length === 1;
              return (
                <span key={r.id} className={`meta-chip marriage-chip ${isPrimary ? 'marriage-primary' : 'marriage-secondary'}`}>
                  <Icon name="ring" /> {sp.name}
                  {r.marriage_date && <span className="marriage-date">({formatDotDate(r.marriage_date, !!r.marriage_lunar)})</span>}
                  {canEdit && spouseRels.length > 1 && !isPrimary && (
                    <button className="btn-set-primary" onClick={() => handleSetPrimary(r.id)}>대표 지정</button>
                  )}
                </span>
              );
            })}
          </div>
          {myMemos && myMemos.length > 0 && (
            <div className="detail-recent-status">
              <div className="recent-status-head">
                <span className="contact-icon"><Icon name="chat" /></span>
                <span className="recent-status-label">메모</span>
                <span className="recent-status-date">나만 보기</span>
              </div>
              {myMemos.map((s, i) => (
                <div key={i} className="recent-status-entry">
                  <div className="recent-status-body">{s.text}</div>
                  <span className="recent-status-date">{formatDotDate(s.at, false)}</span>
                </div>
              ))}
            </div>
          )}
          {(person.phone || person.email) && (
            <div className="detail-contact">
              {person.phone && (
                <div className="contact-row-wrap">
                  <a className="contact-row" href={`tel:${person.phone}`}>
                    <span className="contact-icon"><Icon name="phone" /></span>{person.phone}
                  </a>
                  {canInvite && (
                    <button className="btn-contact-invite" onClick={handleDirectSMSInvite}>SMS 초대</button>
                  )}
                </div>
              )}
              {person.email && (
                <div className="contact-row-wrap">
                  <a className="contact-row" href={`mailto:${person.email}`}>
                    <span className="contact-icon"><Icon name="mail" /></span>{person.email}
                  </a>
                  {canInvite && (
                    <button className="btn-contact-invite email" onClick={handleDirectEmailInvite}>이메일 초대</button>
                  )}
                </div>
              )}
            </div>
          )}

          {canEdit && (
            <div className="detail-action-row">
              <button className="btn-action" onClick={() => setEditing(true)}>
                <span className="btn-action-icon"><Icon name="edit" /></span>편집
              </button>
              {canManageEditGrants && (
                <button
                  className={`btn-action ${showGrantSection ? 'active' : ''}`}
                  onClick={() => setShowGrantSection(s => !s)}
                >
                  <span className="btn-action-icon"><Icon name="key" /></span>권한 관리
                </button>
              )}
              {!person.is_root && !alreadyMapped && (
                <button className="btn-action danger" onClick={handleDelete}>
                  <span className="btn-action-icon"><Icon name="trash" /></span>삭제
                </button>
              )}
            </div>
          )}

          {canManageEditGrants && showGrantSection && <EditGrantSection person={person} />}
        </div>
      )}

      <div className="detail-actions">
        <button className="action-btn primary" onClick={onAddFamily}>
          <span className="action-icon">+</span>{person.name}의 가족 추가하기
        </button>
        {person.is_deceased ? null : alreadyMapped ? (
          <div className="action-mapped-notice">
            <Icon name="lock" /> 이미 계정에 연결된 인물입니다
          </div>
        ) : (
          <button className="action-btn secondary" onClick={handleInvite}>
            <span className="action-icon"><Icon name="link" /></span>{person.name} 님을 가계도로 초대하기
          </button>
        )}
      </div>

      {inviteLink && <InviteLinkBox link={inviteLink} personName={person.name} />}

      {infoRequests.length > 0 && (
        <div className="info-req-section">
          <p className="info-req-title"><Icon name="inbox" /> 정보공개 요청 ({infoRequests.length}건)</p>
          {infoRequests.map(req => (
            <div key={req.id} className="info-req-row">
              <span className="info-req-name">{req.requesterName}님</span>
              <div className="info-req-btns">
                <button
                  className="info-req-approve"
                  onClick={async () => {
                    await approveInfoRequest(req.id, req.personId);
                    removeInfoRequest(req.id);
                  }}
                >수락</button>
                <button
                  className="info-req-reject"
                  onClick={async () => {
                    await rejectInfoRequest(req.id);
                    removeInfoRequest(req.id);
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
