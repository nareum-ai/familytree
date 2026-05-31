import { useEffect, useState } from 'react';
import { useFamilyStore } from '../store/familyStore';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ApprovalRequest, Member, Person, Relationship } from '../types';
import { LS, SS } from '../lib/storageKeys';
import { exportFamilyToCSV, downloadCSV } from '../utils/csvExport';
import { BulkUploadView } from './BulkUploadView';
import './AdminView.css';

const LS_USER_KEY     = LS.USER_NAME;
const LS_FAMILY_ID    = LS.FAMILY_ID;

function fmtDt(iso: string, withTime = true) {
  const d = new Date(iso);
  const yy  = String(d.getFullYear()).slice(2);
  const mm  = String(d.getMonth() + 1).padStart(2, '0');
  const dd  = String(d.getDate()).padStart(2, '0');
  if (!withTime) return `${yy}${mm}${dd}`;
  const hh  = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yy}${mm}${dd} ${hh}:${min}`;
}
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
          listMembers, mapMemberToPerson, deleteMember,
          loginMember, linkGoogleToMember, unlinkGoogleFromMember } = useFamilyStore();

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
  // 접속 로그
  const [logMember, setLogMember] = useState<Member | null>(null);
  const [loginLogs, setLoginLogs] = useState<Array<{ id: string; logged_in_at: string; user_agent: string }>>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showPwChange, setShowPwChange] = useState(false);
  const [adminOldPw,   setAdminOldPw]  = useState('');
  const [adminNewPw,   setAdminNewPw]  = useState('');
  const [adminConfPw,  setAdminConfPw] = useState('');
  const [adminPwMsg,   setAdminPwMsg]  = useState<{ ok: boolean; msg: string } | null>(null);
  const [adminPwLoading, setAdminPwLoading] = useState(false);

  // 구글 연동
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [adminGoogleEmail, setAdminGoogleEmail] = useState<string | null | undefined>(undefined);
  const [googleLinkMsg,    setGoogleLinkMsg]    = useState<{ ok: boolean; msg: string } | null>(null);
  const [googleLinkLoading, setGoogleLinkLoading] = useState(false);

  // 푸시 알림 설정
  interface PushSettings {
    sendHourKST: number;
    offsets: number[];
    maxChusu: number;
    enableBirthday: boolean;
    enableDeathDay: boolean;
  }
  const defaultPush: PushSettings = { sendHourKST: 8, offsets: [0, 1, 3, 7], maxChusu: 6, enableBirthday: true, enableDeathDay: true };
  const [pushSettings, setPushSettings] = useState<PushSettings>(defaultPush);
  const [pushLoading,  setPushLoading]  = useState(true);
  const [pushSaveMsg,  setPushSaveMsg]  = useState<{ ok: boolean; msg: string } | null>(null);

  const adminUsername = localStorage.getItem(LS_USER_KEY) ?? '관리자';
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

  useEffect(() => {
    reload();
    // 푸시 설정 로드
    (async () => {
      try {
        const { getDoc, doc } = await import('firebase/firestore');
        const { db: fdb } = await import('../lib/firebase');
        // 관리자 구글 연동 상태 로드
        const memberId = localStorage.getItem(LS.MEMBER_ID);
        if (memberId) {
          const msnap = await getDoc(doc(fdb, 'members', memberId));
          setAdminGoogleEmail((msnap.data()?.google_email as string | null) ?? null);
        }

        const snap = await getDoc(doc(fdb, 'settings', 'push'));
        if (snap.exists()) {
          const d = snap.data();
          setPushSettings({
            sendHourKST:    typeof d.sendHourKST === 'number' ? d.sendHourKST : 8,
            offsets:        Array.isArray(d.offsets) ? d.offsets : [0, 1, 3, 7],
            maxChusu:       typeof d.maxChusu === 'number' ? d.maxChusu : 6,
            enableBirthday: d.enableBirthday !== false,
            enableDeathDay: d.enableDeathDay !== false,
          });
        }
      } finally {
        setPushLoading(false);
      }
    })();
  }, []);

  const flash = (msg: string) => { setActionMsg(msg); setTimeout(() => setActionMsg(''), 3000); };

  const handleAdminLinkGoogle = async () => {
    setGoogleLinkMsg(null);
    setGoogleLinkLoading(true);
    try {
      const { signInWithPopup } = await import('firebase/auth');
      const { auth, googleProvider } = await import('../lib/firebase');
      const result = await signInWithPopup(auth, googleProvider);
      const uid   = result.user.uid;
      const email = result.user.email ?? '';
      const memberId = localStorage.getItem(LS.MEMBER_ID);
      if (!memberId) return;
      const res = await linkGoogleToMember(memberId, uid, email);
      if (!res.ok) { setGoogleLinkMsg({ ok: false, msg: res.error ?? '연결 실패' }); return; }
      setAdminGoogleEmail(email);
      setGoogleLinkMsg({ ok: true, msg: '구글 계정이 연결됐습니다.' });
    } catch (err: unknown) {
      if ((err as { code?: string })?.code !== 'auth/popup-closed-by-user')
        setGoogleLinkMsg({ ok: false, msg: '연결 중 오류가 발생했습니다.' });
    } finally {
      setGoogleLinkLoading(false);
    }
  };

  const handleAdminUnlinkGoogle = async () => {
    setGoogleLinkMsg(null);
    setGoogleLinkLoading(true);
    try {
      const memberId = localStorage.getItem(LS.MEMBER_ID);
      if (!memberId) return;
      await unlinkGoogleFromMember(memberId);
      setAdminGoogleEmail(null);
      setGoogleLinkMsg({ ok: true, msg: '구글 연결이 해제됐습니다.' });
    } catch {
      setGoogleLinkMsg({ ok: false, msg: '해제 중 오류가 발생했습니다.' });
    } finally {
      setGoogleLinkLoading(false);
    }
  };

  const savePushSettings = async () => {
    setPushSaveMsg(null);
    try {
      const { setDoc, doc } = await import('firebase/firestore');
      const { db: fdb } = await import('../lib/firebase');
      await setDoc(doc(fdb, 'settings', 'push'), pushSettings);
      setPushSaveMsg({ ok: true, msg: '✅ 설정이 저장됐습니다.' });
    } catch {
      setPushSaveMsg({ ok: false, msg: '❌ 저장 중 오류가 발생했습니다.' });
    }
    setTimeout(() => setPushSaveMsg(null), 3000);
  };

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

  // 이미 다른 계정에 매핑된 person_id 집합 (매핑 중인 멤버 자신 제외)
  const mappedPersonIds = new Set(
    members
      .filter(m => m.id !== mappingMember?.id)
      .map(m => m.person_id)
      .filter((id): id is string => id !== null)
  );

  // 사람 검색
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const snap = await getDocs(
        query(collection(db, 'persons'), where('name', '==', searchQuery.trim()))
      );
      // 이미 다른 계정에 매핑된 노드는 결과에서 제외
      setSearchResults(
        snap.docs
          .map(d => ({
            id:       d.id,
            name:     d.data().name     as string,
            familyId: d.data().family_id as string,
            deceased: !!(d.data().is_deceased),
          }))
          .filter(p => !mappedPersonIds.has(p.id))
      );
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

  const handleAdminPwChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminPwMsg(null);
    if (adminNewPw.length < 6) { setAdminPwMsg({ ok: false, msg: '새 비밀번호는 6자 이상이어야 합니다.' }); return; }
    if (adminNewPw !== adminConfPw) { setAdminPwMsg({ ok: false, msg: '새 비밀번호가 일치하지 않습니다.' }); return; }
    setAdminPwLoading(true);
    try {
      const member = await loginMember(adminUsername, adminOldPw);
      if (!member) { setAdminPwMsg({ ok: false, msg: '현재 비밀번호가 올바르지 않습니다.' }); return; }
      const { hashPassword } = await import('../utils/crypto');
      const { updateDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const newHash = await hashPassword(adminNewPw);
      await updateDoc(doc(db, 'members', member.id), { password_hash: newHash });
      setAdminPwMsg({ ok: true, msg: '비밀번호가 변경됐습니다.' });
      setAdminOldPw(''); setAdminNewPw(''); setAdminConfPw('');
    } catch {
      setAdminPwMsg({ ok: false, msg: '변경 중 오류가 발생했습니다.' });
    } finally {
      setAdminPwLoading(false);
    }
  };

  const handleShowLogs = async (m: Member) => {
    setLogMember(m);
    setLogsLoading(true);
    setLoginLogs([]);
    try {
      const snap = await getDocs(
        query(
          collection(db, 'login_logs'),
          where('member_id', '==', m.id),
          orderBy('logged_in_at', 'desc'),
          limit(20)
        )
      );
      setLoginLogs(snap.docs.map(d => ({
        id: d.id,
        logged_in_at: d.data().logged_in_at as string,
        user_agent:   d.data().user_agent as string ?? '',
      })));
    } finally {
      setLogsLoading(false);
    }
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="admin-pw-btn" onClick={() => { setShowGoogleModal(true); setGoogleLinkMsg(null); }}>
            🔗 구글 연동{adminGoogleEmail ? ' ✓' : ''}
          </button>
          <button className="admin-pw-btn" onClick={() => { setShowPwChange(true); setAdminPwMsg(null); }}>
            🔑 비밀번호
          </button>
          <button className="admin-logout" onClick={onLogout}>로그아웃</button>
        </div>
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
                <span className="col-login">최근 접속</span>
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
                      {fmtDt(m.created_at, false)}
                    </span>
                    <span className="col-login member-date">
                      {m.last_login_at
                        ? <button className="btn-log" onClick={() => handleShowLogs(m)}>
                            {fmtDt(m.last_login_at)}
                          </button>
                        : <span style={{color:'#ccc'}}>미접속</span>}
                    </span>
                    <span className="col-actions">
                      {m.family_id && m.person_id && (
                        <button className="btn-login-as" onClick={() => handleLoginAsMember(m)}>
                          접속
                        </button>
                      )}
                      <button className="btn-log-icon" onClick={() => handleShowLogs(m)} title="접속 로그">
                        📋{m.last_login_at ? <span className="log-dot log-dot-on"/> : <span className="log-dot"/>}
                      </button>
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
                    <span className="req-date">{fmtDt(r.created_at)}</span>
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
        {/* 푸시 알림 설정 */}
        <section className="admin-section">
          <h2>🔔 푸시 알림 설정</h2>
          {pushLoading ? <p className="admin-empty">불러오는 중...</p> : (
            <div className="push-settings">

              {/* 발송 시간 */}
              <div className="push-row">
                <label className="push-label">발송 시간 (KST)</label>
                <select
                  className="push-select"
                  value={pushSettings.sendHourKST}
                  onChange={e => setPushSettings(s => ({ ...s, sendHourKST: Number(e.target.value) }))}
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </div>

              {/* 알림 시기 */}
              <div className="push-row push-row-col">
                <label className="push-label">알림 시기 (몇 일 전)</label>
                <div className="push-offsets">
                  {[0, 1, 3, 7, 14, 30].map(day => (
                    <label key={day} className="push-check-label">
                      <input
                        type="checkbox"
                        checked={pushSettings.offsets.includes(day)}
                        onChange={e => {
                          const next = e.target.checked
                            ? [...pushSettings.offsets, day].sort((a, b) => a - b)
                            : pushSettings.offsets.filter(d => d !== day);
                          setPushSettings(s => ({ ...s, offsets: next }));
                        }}
                      />
                      {day === 0 ? '당일' : `${day}일 전`}
                    </label>
                  ))}
                </div>
              </div>

              {/* 촌수 범위 */}
              <div className="push-row">
                <label className="push-label">알림 대상 촌수</label>
                <select
                  className="push-select"
                  value={pushSettings.maxChusu}
                  onChange={e => setPushSettings(s => ({ ...s, maxChusu: Number(e.target.value) }))}
                >
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <option key={n} value={n}>{n}촌 이내</option>
                  ))}
                </select>
              </div>

              {/* 알림 종류 */}
              <div className="push-row push-row-col">
                <label className="push-label">알림 종류</label>
                <div className="push-toggles">
                  <label className="push-check-label">
                    <input
                      type="checkbox"
                      checked={pushSettings.enableBirthday}
                      onChange={e => setPushSettings(s => ({ ...s, enableBirthday: e.target.checked }))}
                    />
                    🎂 생일 알림
                  </label>
                  <label className="push-check-label">
                    <input
                      type="checkbox"
                      checked={pushSettings.enableDeathDay}
                      onChange={e => setPushSettings(s => ({ ...s, enableDeathDay: e.target.checked }))}
                    />
                    🕯️ 기일 알림
                  </label>
                </div>
              </div>

              {pushSaveMsg && (
                <p className={`push-save-msg ${pushSaveMsg.ok ? 'ok' : 'err'}`}>{pushSaveMsg.msg}</p>
              )}
              <button className="push-save-btn" onClick={savePushSettings}>저장</button>
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

      {/* 관리자 비밀번호 변경 모달 */}
      {showPwChange && (
        <div className="confirm-backdrop" onClick={() => setShowPwChange(false)}>
          <div className="confirm-box" onClick={e => e.stopPropagation()} style={{ width: 340 }}>
            <h3>🔑 관리자 비밀번호 변경</h3>
            <form onSubmit={handleAdminPwChange} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
              <input
                className="map-search-input"
                type="password"
                value={adminOldPw}
                onChange={e => setAdminOldPw(e.target.value)}
                placeholder="현재 비밀번호"
                autoFocus
              />
              <input
                className="map-search-input"
                type="password"
                value={adminNewPw}
                onChange={e => setAdminNewPw(e.target.value)}
                placeholder="새 비밀번호 (6자 이상)"
              />
              <input
                className="map-search-input"
                type="password"
                value={adminConfPw}
                onChange={e => setAdminConfPw(e.target.value)}
                placeholder="새 비밀번호 확인"
              />
              {adminPwMsg && (
                <p style={{ fontSize: 13, textAlign: 'center', margin: 0,
                  color: adminPwMsg.ok ? '#16a34a' : '#e53e3e' }}>
                  {adminPwMsg.msg}
                </p>
              )}
              <div className="confirm-actions">
                <button type="button" className="btn-cancel-confirm"
                  onClick={() => { setShowPwChange(false); setAdminOldPw(''); setAdminNewPw(''); setAdminConfPw(''); }}>
                  취소
                </button>
                <button type="submit" className="btn-approve"
                  disabled={adminPwLoading || !adminOldPw || !adminNewPw || !adminConfPw}
                  style={{ flex: 1 }}>
                  {adminPwLoading ? '변경 중...' : '변경'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 구글 연동 모달 */}
      {showGoogleModal && (
        <div className="confirm-backdrop" onClick={() => setShowGoogleModal(false)}>
          <div className="confirm-box" onClick={e => e.stopPropagation()} style={{ width: 320 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="40" height="40">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
            </div>
            <h3 style={{ fontSize: 16, marginBottom: 6 }}>구글 계정 연동</h3>
            {adminGoogleEmail ? (
              <>
                <p style={{ fontSize: 13, color: '#16a34a', fontWeight: 600, marginBottom: 4 }}>● 연결됨</p>
                <p style={{ fontSize: 13, color: '#4a5568', marginBottom: 16 }}>{adminGoogleEmail}</p>
                {googleLinkMsg && <p style={{ fontSize: 13, marginBottom: 10, color: googleLinkMsg.ok ? '#16a34a' : '#e53e3e' }}>{googleLinkMsg.msg}</p>}
                <div className="confirm-actions">
                  <button className="btn-cancel-confirm" onClick={() => setShowGoogleModal(false)}>닫기</button>
                  <button className="btn-delete-confirm"
                    style={{ background: '#e53e3e' }}
                    disabled={googleLinkLoading}
                    onClick={handleAdminUnlinkGoogle}>
                    {googleLinkLoading ? '처리 중...' : '연결 해제'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
                  구글 계정을 연결하면 비밀번호 없이 로그인할 수 있습니다.
                </p>
                {googleLinkMsg && <p style={{ fontSize: 13, marginBottom: 10, color: googleLinkMsg.ok ? '#16a34a' : '#e53e3e' }}>{googleLinkMsg.msg}</p>}
                <div className="confirm-actions">
                  <button className="btn-cancel-confirm" onClick={() => setShowGoogleModal(false)}>취소</button>
                  <button className="btn-approve" style={{ flex: 1 }}
                    disabled={googleLinkLoading}
                    onClick={handleAdminLinkGoogle}>
                    {googleLinkLoading ? '처리 중...' : '구글로 연결'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 접속 로그 모달 */}
      {logMember && (
        <div className="confirm-backdrop" onClick={() => setLogMember(null)}>
          <div className="confirm-box log-box" onClick={e => e.stopPropagation()}>
            <h3>📋 {logMember.username} 접속 로그</h3>
            {logsLoading ? (
              <p className="admin-empty">불러오는 중...</p>
            ) : loginLogs.length === 0 ? (
              <p className="admin-empty">접속 기록이 없습니다.</p>
            ) : (
              <div className="log-list">
                {loginLogs.map((l, i) => {
                  const mobile = /Mobile|Android|iPhone/i.test(l.user_agent);
                  const browser = l.user_agent.includes('Chrome') ? 'Chrome'
                    : l.user_agent.includes('Safari') ? 'Safari'
                    : l.user_agent.includes('Firefox') ? 'Firefox' : '기타';
                  return (
                    <div key={l.id} className="log-row">
                      <span className="log-num">{i + 1}</span>
                      <div className="log-info">
                        <span className="log-date">
                          {fmtDt(l.logged_in_at)}
                        </span>
                        <span className="log-device">{mobile ? '📱 모바일' : '💻 PC'} · {browser}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <button className="btn-cancel-confirm" style={{ marginTop: 12, width: '100%' }}
              onClick={() => setLogMember(null)}>닫기</button>
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
