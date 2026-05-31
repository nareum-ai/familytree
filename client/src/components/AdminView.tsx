import { useEffect, useState } from 'react';
import { useFamilyStore } from '../store/familyStore';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ApprovalRequest, Member, Person, Relationship } from '../types';
import { LS, SS } from '../lib/storageKeys';
import { exportFamilyToCSV, downloadCSV } from '../utils/csvExport';
import { BulkUploadView } from './BulkUploadView';
import './AdminView.css';

const LS_USER_KEY     = LS.USER_NAME;
const LS_FAMILY_ID    = LS.FAMILY_ID;
const LS_IS_ADMIN     = LS.IS_ADMIN;
const LS_ADMIN_RETURN = LS.ADMIN_RETURN;

interface FamilyInfo {
  familyId: string; rootName: string; createdAt: string;
  disabled: boolean; rootPersonId: string;
}

interface Props { onLogout: () => void; }

export function AdminView({ onLogout }: Props) {
  const { loadApprovalRequests, approveRequest, rejectRequest,
          listFamilies, toggleFamilyStatus, deleteFamily,
          listMembers, mapMemberToPerson, deleteMember } = useFamilyStore();

  const [requests, setRequests]     = useState<ApprovalRequest[]>([]);
  const [families, setFamilies]     = useState<FamilyInfo[]>([]);
  const [members,  setMembers]      = useState<Member[]>([]);
  const [loading,  setLoading]      = useState(true);
  const [actionMsg, setActionMsg]   = useState('');
  const [confirmDelete, setConfirmDelete] = useState<FamilyInfo | null>(null);
  // 매핑 UI
  const [mappingMember, setMappingMember]     = useState<Member | null>(null);
  const [searchQuery,   setSearchQuery]       = useState('');
  const [searchResults, setSearchResults]     = useState<Array<{ id: string; name: string; familyId: string; deceased: boolean }>>([]);
  // 회원 목록 필터/페이지
  const [memberFilter,  setMemberFilter]      = useState('');
  const [memberPage,    setMemberPage]        = useState(0);
  const [confirmDelMember, setConfirmDelMember] = useState<Member | null>(null);
  const [bulkTarget, setBulkTarget] = useState<{ id: string; rootName: string } | 'new' | null>(null);
  const MEMBER_PAGE_SIZE = 10;

  const reload = async () => {
    setLoading(true);
    const [reqs, fams, mems] = await Promise.all([
      loadApprovalRequests(), listFamilies(), listMembers(),
    ]);
    setRequests(reqs);
    setFamilies(fams);
    setMembers(mems.filter(m => !m.is_admin));
    setMemberPage(0);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const flash = (msg: string) => { setActionMsg(msg); setTimeout(() => setActionMsg(''), 3000); };

  const handleApprove = async (req: ApprovalRequest) => {
    await approveRequest(req.id, req.requested_name);
    flash(`✅ "${req.requested_name}" 승인됨`);
    reload();
  };
  const handleReject = async (req: ApprovalRequest) => {
    await rejectRequest(req.id);
    flash(`❌ "${req.requested_name}" 거절됨`);
    reload();
  };
  const handleEnterFamily = (fam: FamilyInfo) => {
    localStorage.removeItem(LS_IS_ADMIN);
    localStorage.setItem(LS_ADMIN_RETURN, 'true');
    localStorage.setItem(LS_USER_KEY, fam.rootName);
    localStorage.setItem(LS_FAMILY_ID, fam.familyId);
    window.location.reload();
  };
  const handleToggle = async (fam: FamilyInfo) => {
    await toggleFamilyStatus(fam.rootPersonId, !fam.disabled);
    flash(fam.disabled ? `✅ "${fam.rootName}" 활성화` : `🚫 "${fam.rootName}" 비활성화`);
    reload();
  };
  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    await deleteFamily(confirmDelete.familyId);
    flash(`🗑️ "${confirmDelete.rootName}" 삭제`);
    setConfirmDelete(null);
    reload();
  };

  // 사람 검색
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const snap = await getDocs(
        query(collection(db, 'persons'), where('name', '==', searchQuery.trim()))
      );
      setSearchResults(snap.docs.map(d => ({
        id:       d.id,
        name:     d.data().name     as string,
        familyId: d.data().family_id as string,
        deceased: !!(d.data().is_deceased),
      })));
    } catch {
      // search failed silently
    }
  };

  const handleMap = async (person: { id: string; name: string; familyId: string }) => {
    if (!mappingMember) return;
    await mapMemberToPerson(mappingMember.id, person.id, person.familyId, person.name);
    flash(`✅ "${mappingMember.username}" → "${person.name}" 매핑 완료`);
    setMappingMember(null);
    setSearchQuery('');
    setSearchResults([]);
    reload();
  };

  const handleExport = async (fam: FamilyInfo) => {
    const [pSnap, rSnap] = await Promise.all([
      getDocs(query(collection(db, 'persons'),      where('family_id', '==', fam.familyId))),
      getDocs(query(collection(db, 'relationships'), where('family_id', '==', fam.familyId))),
    ]);
    const persons       = pSnap.docs.map(d => ({ ...(d.data() as Omit<Person, 'id'>), id: d.id })) as Person[];
    const relationships = rSnap.docs.map(d => ({ ...(d.data() as Omit<Relationship, 'id'>), id: d.id })) as Relationship[];
    const csv = exportFamilyToCSV(persons, relationships);
    downloadCSV(`${fam.rootName}_가계도.csv`, csv);
  };

  const handleDeleteMember = async () => {
    if (!confirmDelMember) return;
    await deleteMember(confirmDelMember.id);
    flash(`🗑️ "${confirmDelMember.username}" 계정 삭제됨`);
    setConfirmDelMember(null);
    reload();
  };

  const handleLoginAsMember = (m: Member) => {
    if (!m.family_id || !m.person_id) {
      flash('⚠️ 가족 또는 인물이 매핑되지 않은 계정입니다.');
      return;
    }
    localStorage.removeItem(LS_IS_ADMIN);
    localStorage.setItem(LS_ADMIN_RETURN, 'true');
    localStorage.setItem(LS_USER_KEY,      m.person_name ?? m.username);
    localStorage.setItem(LS_FAMILY_ID,     m.family_id);
    localStorage.setItem(LS.MEMBER_ID,     m.id);
    localStorage.setItem(LS.ACCOUNT_NAME,  m.username);
    sessionStorage.setItem(SS.VIEWPOINT_PERSON_ID, m.person_id);
    window.location.reload();
  };

  // 필터링된 회원 목록
  const filteredMembers = members.filter(m =>
    !memberFilter ||
    m.username.toLowerCase().includes(memberFilter.toLowerCase()) ||
    (m.person_name ?? '').includes(memberFilter)
  );
  const totalPages  = Math.ceil(filteredMembers.length / MEMBER_PAGE_SIZE);
  const pagedMembers = filteredMembers.slice(
    memberPage * MEMBER_PAGE_SIZE,
    (memberPage + 1) * MEMBER_PAGE_SIZE
  );

  return (
    <div className="admin-wrap">
      <div className="admin-header">
        <div className="admin-logo">🛡️ 관리자 패널</div>
        <button className="admin-logout" onClick={onLogout}>로그아웃</button>
      </div>
      {actionMsg && <div className="admin-msg">{actionMsg}</div>}

      <div className="admin-body">

        {/* 회원 관리 */}
        <section className="admin-section">
          <div className="member-header">
            <h2>👤 회원 관리 ({members.length}명)</h2>
            <input
              className="member-search"
              type="text"
              value={memberFilter}
              onChange={e => { setMemberFilter(e.target.value); setMemberPage(0); }}
              placeholder="아이디 / 이름 검색"
            />
          </div>

          {loading ? <p className="admin-empty">불러오는 중...</p> :
           members.length === 0 ? <p className="admin-empty">가입된 회원이 없습니다.</p> : (
            <>
              {/* 테이블 헤더 */}
              <div className="member-table-head">
                <span className="col-idx">#</span>
                <span className="col-id">아이디</span>
                <span className="col-map">매핑 인물</span>
                <span className="col-date">가입일</span>
                <span className="col-actions">관리</span>
              </div>

              <div className="admin-list member-list">
                {pagedMembers.map((m, idx) => (
                  <div key={m.id} className="admin-member-row">
                    <span className="col-idx">{memberPage * MEMBER_PAGE_SIZE + idx + 1}</span>
                    <span className="col-id member-id">{m.username}</span>
                    <span className="col-map">
                      {m.person_name
                        ? <span className="member-mapped">✓ {m.person_name}</span>
                        : <span className="member-unmapped">미매핑</span>}
                    </span>
                    <span className="col-date member-date">
                      {new Date(m.created_at).toLocaleDateString('ko-KR')}
                    </span>
                    <span className="col-actions">
                      {m.family_id && m.person_id && (
                        <button className="btn-login-as" onClick={() => handleLoginAsMember(m)}>
                          접속
                        </button>
                      )}
                      <button className="btn-map-sm" onClick={() => { setMappingMember(m); setSearchQuery(''); setSearchResults([]); }}>
                        {m.person_name ? '재매핑' : '매핑'}
                      </button>
                      <button className="btn-del-member" onClick={() => setConfirmDelMember(m)}>
                        삭제
                      </button>
                    </span>
                  </div>
                ))}
              </div>

              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div className="member-pagination">
                  <button disabled={memberPage === 0} onClick={() => setMemberPage(p => p - 1)}>‹</button>
                  <span>{memberPage + 1} / {totalPages}</span>
                  <button disabled={memberPage >= totalPages - 1} onClick={() => setMemberPage(p => p + 1)}>›</button>
                </div>
              )}
            </>
          )}
        </section>

        {/* 승인 대기 */}
        <section className="admin-section">
          <h2>📋 승인 대기 ({requests.length}건)</h2>
          {loading ? <p className="admin-empty">불러오는 중...</p> :
           requests.length === 0 ? <p className="admin-empty">대기 없음</p> : (
            <div className="admin-list">
              {requests.map(r => (
                <div key={r.id} className="admin-req-row">
                  <div className="req-info">
                    <span className="req-name">{r.requested_name}</span>
                    {r.member_username && (
                      <span className="req-member">계정: {r.member_username}</span>
                    )}
                    {r.description && (
                      <span className="req-desc">"{r.description}"</span>
                    )}
                    <span className="req-date">{new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
                  </div>
                  <div className="req-actions">
                    <button className="btn-approve" onClick={() => handleApprove(r)}>승인</button>
                    <button className="btn-reject"  onClick={() => handleReject(r)}>거절</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 가족집단 목록 */}
        <section className="admin-section">
          <div className="section-head">
            <h2>👨‍👩‍👧‍👦 가족집단 ({families.length}개)</h2>
            <button className="btn-bulk-new" onClick={() => setBulkTarget('new')}>📥 새 가족 일괄 등록</button>
          </div>
          {loading ? <p className="admin-empty">불러오는 중...</p> :
           families.length === 0 ? <p className="admin-empty">없음</p> : (
            <div className="admin-list">
              {families.map(f => (
                <div key={f.familyId} className={`admin-fam-row ${f.disabled ? 'disabled' : ''}`}>
                  <div className="fam-info">
                    <span className="fam-root">👤 {f.rootName}</span>
                    {f.disabled && <span className="fam-badge disabled-badge">비활성</span>}
                    <span className="fam-id">{f.familyId.slice(0, 8)}</span>
                  </div>
                  <div className="fam-actions">
                    <button className="btn-enter"   onClick={() => handleEnterFamily(f)} disabled={f.disabled}>보기</button>
                    <button className="btn-export"  onClick={() => handleExport(f)}>📤</button>
                    <button className="btn-upload"  onClick={() => setBulkTarget({ id: f.familyId, rootName: f.rootName })}>📥</button>
                    <button className={f.disabled ? 'btn-enable' : 'btn-disable'} onClick={() => handleToggle(f)}>
                      {f.disabled ? '활성화' : '비활성화'}
                    </button>
                    <button className="btn-delete" onClick={() => setConfirmDelete(f)}>삭제</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 삭제 확인 모달 */}
      {confirmDelete && (
        <div className="confirm-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="confirm-box" onClick={e => e.stopPropagation()}>
            <h3>⚠️ 가족집단 완전 삭제</h3>
            <p><strong>{confirmDelete.rootName}</strong> 가족집단의 모든 데이터가 영구 삭제됩니다.<span className="confirm-warn">되돌릴 수 없습니다.</span></p>
            <div className="confirm-actions">
              <button className="btn-cancel-confirm" onClick={() => setConfirmDelete(null)}>취소</button>
              <button className="btn-delete-confirm" onClick={handleDeleteConfirm}>완전 삭제</button>
            </div>
          </div>
        </div>
      )}

      {/* 계정 삭제 확인 모달 */}
      {confirmDelMember && (
        <div className="confirm-backdrop" onClick={() => setConfirmDelMember(null)}>
          <div className="confirm-box" onClick={e => e.stopPropagation()}>
            <h3>⚠️ 계정 삭제</h3>
            <p>
              <strong>{confirmDelMember.username}</strong> 계정을 삭제합니다.
              <span className="confirm-warn">로그인 기록이 영구 삭제됩니다.</span>
            </p>
            <div className="confirm-actions">
              <button className="btn-cancel-confirm" onClick={() => setConfirmDelMember(null)}>취소</button>
              <button className="btn-delete-confirm" onClick={handleDeleteMember}>삭제</button>
            </div>
          </div>
        </div>
      )}

      {/* 사람 매핑 모달 */}
      {mappingMember && (
        <div className="confirm-backdrop" onClick={() => setMappingMember(null)}>
          <div className="confirm-box mapping-box" onClick={e => e.stopPropagation()}>
            <h3>👤 사람 매핑</h3>
            <p><strong>{mappingMember.username}</strong> 회원을 트리의 누구와 연결할까요?</p>
            <div className="map-search-row">
              <input
                className="map-search-input"
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="이름으로 검색"
                autoFocus
              />
              <button className="map-search-btn" onClick={handleSearch}>검색</button>
            </div>
            {searchResults.length > 0 && (
              <div className="map-results">
                {searchResults.map(p => (
                  <div
                    key={p.id}
                    className={`map-result-row ${p.deceased ? 'map-result-deceased' : ''}`}
                    onClick={() => !p.deceased && handleMap(p)}
                    title={p.deceased ? '사망자는 매핑할 수 없습니다' : ''}
                  >
                    <span className="map-result-name">
                      {p.name}
                      {p.deceased && <span className="deceased-tag"> (고인)</span>}
                    </span>
                    <span className="map-result-fid">{p.familyId.slice(0, 8)}</span>
                  </div>
                ))}
              </div>
            )}
            {searchResults.length === 0 && searchQuery && (
              <p className="admin-empty">검색 결과 없음</p>
            )}
            <button className="btn-cancel-confirm" style={{marginTop: 12, width: '100%'}} onClick={() => setMappingMember(null)}>취소</button>
          </div>
        </div>
      )}

      {/* 일괄 업로드 모달 */}
      {bulkTarget !== null && (
        <BulkUploadView
          targetFamily={bulkTarget === 'new' ? undefined : bulkTarget}
          onClose={() => setBulkTarget(null)}
          onDone={reload}
        />
      )}
    </div>
  );
}
