import { useEffect, useRef, useState } from 'react';


function AdminPager({ current, total, onChange }: {
  current: number; total: number; onChange: (p: number) => void;
}) {
  if (total <= 1) return null;

  const pages: (number | '…')[] = [];
  if (total <= 7) {
    for (let i = 0; i < total; i++) pages.push(i);
  } else {
    pages.push(0);
    if (current > 2) pages.push('…');
    for (let i = Math.max(1, current - 1); i <= Math.min(total - 2, current + 1); i++) pages.push(i);
    if (current < total - 3) pages.push('…');
    pages.push(total - 1);
  }

  return (
    <div className="member-pagination">
      <button disabled={current === 0} onClick={() => onChange(current - 1)}>‹</button>
      {pages.map((p, i) =>
        p === '…'
          ? <span key={`e${i}`} className="pager-ellipsis">…</span>
          : <button
              key={p}
              className={p === current ? 'pager-active' : ''}
              onClick={() => onChange(p as number)}
            >{(p as number) + 1}</button>
      )}
      <button disabled={current >= total - 1} onClick={() => onChange(current + 1)}>›</button>
    </div>
  );
}

// UA → OS·브라우저 요약
function parseUA(ua: string): string {
  if (!ua) return '알 수 없음';
  let os = '';
  if      (/Android/i.test(ua))  os = '안드로이드';
  else if (/iPhone/i.test(ua))   os = '아이폰';
  else if (/iPad/i.test(ua))     os = '아이패드';
  else if (/Windows/i.test(ua))  os = 'Windows';
  else if (/Macintosh/i.test(ua)) os = 'Mac';
  else if (/Linux/i.test(ua))    os = 'Linux';
  let br = '';
  if      (/SamsungBrowser/i.test(ua))                   br = '삼성 브라우저';
  else if (/Whale/i.test(ua))                            br = '네이버 웨일';
  else if (/OPR|Opera/i.test(ua))                        br = 'Opera';
  else if (/Edg/i.test(ua))                              br = 'Edge';
  else if (/Chrome/i.test(ua) && !/Chromium/i.test(ua)) br = 'Chrome';
  else if (/Firefox/i.test(ua))                          br = 'Firefox';
  else if (/Safari/i.test(ua))                           br = 'Safari';
  return [os, br].filter(Boolean).join(' · ') || '알 수 없음';
}


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
  disabled: boolean; rootPersonId: string; personCount: number;
}

interface Props { onLogout: () => void; }

export function AdminView({ onLogout }: Props) {
  const { loadApprovalRequests, approveRequest, rejectRequest,
          listFamilies, toggleFamilyStatus, deleteFamily,
          listMembers, mapMemberToPerson, deleteMember,
          loginMember, linkGoogleToMember, unlinkGoogleFromMember,
          loadPasswordResetRequests, approvePasswordResetRequest, rejectPasswordResetRequest } = useFamilyStore();

  const [requests, setRequests]           = useState<ApprovalRequest[]>([]);
  const [resetRequests, setResetRequests] = useState<import('../types').PasswordResetRequest[]>([]);
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
  const [familyFilter, setFamilyFilter] = useState('');
  const [familyPage,   setFamilyPage]   = useState(0);
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

  const [pushSettings, setPushSettings] = useState<{ sendHourKST: number }>({ sendHourKST: 8 });
  const [pushLoading,  setPushLoading]  = useState(true);
  const [pushSaveMsg,  setPushSaveMsg]  = useState<{ ok: boolean; msg: string } | null>(null);

  // 활동 로그
  interface ActivityLog { id: string; at: string; action: 'add' | 'delete'; person_name: string; actor_name: string; }
  const [actLogs,       setActLogs]       = useState<ActivityLog[]>([]);
  const [actLogsLoading, setActLogsLoading] = useState(false);
  const [actLogsLoaded,  setActLogsLoaded]  = useState(false);
  const [actLogPage,     setActLogPage]     = useState(0);
  const ACT_LOG_PAGE_SIZE = 30;

  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showSettingsMenu) return;
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node))
        setShowSettingsMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSettingsMenu]);

  const adminUsername = localStorage.getItem(LS_USER_KEY) ?? '관리자';
  const MEMBER_PAGE_SIZE  = 25;
  const FAMILY_PAGE_SIZE  = 20;

  const reload = async () => {
    setLoading(true);
    const [reqs, fams, mems, resetReqs] = await Promise.all([
      loadApprovalRequests(), listFamilies(), listMembers(), loadPasswordResetRequests(),
    ]);
    setRequests(reqs);
    setFamilies(fams);
    setMembers(mems.filter(m => !m.is_admin));
    setResetRequests(resetReqs);
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
          if (typeof d.sendHourKST === 'number') setPushSettings({ sendHourKST: d.sendHourKST });
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
      await setDoc(doc(fdb, 'settings', 'push'), { sendHourKST: pushSettings.sendHourKST }, { merge: true });
      setPushSaveMsg({ ok: true, msg: '✅ 저장됐습니다.' });
    } catch {
      setPushSaveMsg({ ok: false, msg: '❌ 저장 중 오류가 발생했습니다.' });
    }
    setTimeout(() => setPushSaveMsg(null), 3000);
  };

  const loadActLogs = async () => {
    setActLogsLoading(true);
    try {
      const { getDocs, collection, query, orderBy, limit } = await import('firebase/firestore');
      const { db: fdb } = await import('../lib/firebase');
      const snap = await getDocs(query(collection(fdb, 'activity_logs'), orderBy('at', 'desc'), limit(100)));
      setActLogs(snap.docs.map(d => ({
        id: d.id,
        at:          d.data().at          as string,
        action:      d.data().action      as 'add' | 'delete',
        person_name: d.data().person_name as string,
        actor_name:  d.data().actor_name  as string,
      })));
      setActLogsLoaded(true);
    } finally {
      setActLogsLoading(false);
    }
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
    localStorage.setItem(LS_ADMIN_RETURN,  'true');
    localStorage.setItem(LS_USER_KEY,      fam.rootName);
    localStorage.setItem(LS_FAMILY_ID,     fam.familyId);
    localStorage.setItem(LS.MY_PERSON_ID,  fam.rootPersonId);
    localStorage.removeItem(LS.MEMBER_ID);   // 관리자 MEMBER_ID 오염 방지
    sessionStorage.setItem(SS.VIEWPOINT_PERSON_ID, fam.rootPersonId);
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

  // 사람 검색 — 이름 전방 일치 + 이름(first_name) 전방 일치 병합
  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    try {
      const end = q + '';
      const [byName, byFirst] = await Promise.all([
        getDocs(query(collection(db, 'persons'),
          where('name',       '>=', q), where('name',       '<=', end), limit(30))),
        getDocs(query(collection(db, 'persons'),
          where('first_name', '>=', q), where('first_name', '<=', end), limit(30))),
      ]);
      const seen = new Set<string>();
      const results: Array<{ id: string; name: string; familyId: string; deceased: boolean }> = [];
      for (const d of [...byName.docs, ...byFirst.docs]) {
        if (seen.has(d.id) || mappedPersonIds.has(d.id)) continue;
        seen.add(d.id);
        results.push({
          id:       d.id,
          name:     d.data().name       as string,
          familyId: d.data().family_id  as string,
          deceased: !!(d.data().is_deceased),
        });
      }
      setSearchResults(results);
    } catch {
      // silent
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
    localStorage.setItem(LS_ADMIN_RETURN,  'true');
    localStorage.setItem(LS_USER_KEY,      m.person_name ?? m.username);
    localStorage.setItem(LS_FAMILY_ID,     m.family_id);
    localStorage.setItem(LS.MEMBER_ID,     m.id);
    localStorage.setItem(LS.MY_PERSON_ID,  m.person_id);
    localStorage.setItem(LS.ACCOUNT_NAME,  m.username);
    sessionStorage.setItem(SS.VIEWPOINT_PERSON_ID, m.person_id);
    window.location.reload();
  };

  // 필터링 + 최종 접속일 내림차순 정렬
  const filteredMembers = members
    .filter(m =>
      !memberFilter ||
      m.username.toLowerCase().includes(memberFilter.toLowerCase()) ||
      (m.person_name ?? '').includes(memberFilter)
    )
    .sort((a, b) => {
      if (!a.last_login_at && !b.last_login_at) return 0;
      if (!a.last_login_at) return 1;
      if (!b.last_login_at) return -1;
      return b.last_login_at.localeCompare(a.last_login_at);
    });
  const totalMemberPages = Math.ceil(filteredMembers.length / MEMBER_PAGE_SIZE);
  const pagedMembers = filteredMembers.slice(
    memberPage * MEMBER_PAGE_SIZE,
    (memberPage + 1) * MEMBER_PAGE_SIZE
  );

  // 가족집단 필터 + 페이지
  const filteredFamilies = families.filter(f =>
    !familyFilter || f.rootName.includes(familyFilter)
  );
  const totalFamilyPages = Math.ceil(filteredFamilies.length / FAMILY_PAGE_SIZE);
  const pagedFamilies = filteredFamilies.slice(
    familyPage * FAMILY_PAGE_SIZE,
    (familyPage + 1) * FAMILY_PAGE_SIZE
  );

  return (
    <div className="admin-wrap">
      <div className="admin-header">
        <div className="admin-logo">🛡️ 관리자 패널</div>
        <div className="admin-header-right">
          {requests.length > 0 && (
            <span className="admin-pending-badge">{requests.length}건 승인 대기</span>
          )}
          <div className="admin-settings-wrap" ref={settingsRef}>
            <button
              className="admin-icon-btn"
              onClick={() => setShowSettingsMenu(v => !v)}
              title="설정"
            >⚙️</button>
            {showSettingsMenu && (
              <div className="admin-settings-dropdown" onClick={() => setShowSettingsMenu(false)}>
                <button onClick={() => { setShowGoogleModal(true); setGoogleLinkMsg(null); }}>
                  🔗 구글 연동{adminGoogleEmail ? ' ✓' : ''}
                </button>
                <button onClick={() => { setShowPwChange(true); setAdminPwMsg(null); }}>
                  🔑 비밀번호 변경
                </button>
              </div>
            )}
          </div>
          <button className="admin-logout" onClick={onLogout}>로그아웃</button>
        </div>
      </div>
      {actionMsg && <div className="admin-msg">{actionMsg}</div>}

      <div className="admin-body">

        {/* 승인 대기 — 최우선 */}
        <section className={`admin-section ${requests.length > 0 ? 'section-urgent' : ''}`}>
          <h2>
            📋 승인 대기
            {requests.length > 0
              ? <span className="req-count-badge">{requests.length}</span>
              : <span className="req-count-zero"> (없음)</span>}
          </h2>
          {loading ? <p className="admin-empty">불러오는 중...</p> :
           requests.length === 0 ? <p className="admin-empty">현재 대기 중인 신청이 없습니다.</p> : (
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
                <span className="col-login">최종 접속</span>
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
              <AdminPager current={memberPage} total={totalMemberPages} onChange={setMemberPage} />
            </>
          )}
        </section>

        {/* 비밀번호 초기화 요청 */}
        <section className={`admin-section ${resetRequests.length > 0 ? 'section-urgent' : ''}`}>
          <h2>
            🔑 비밀번호 초기화 요청
            {resetRequests.length > 0
              ? <span className="req-count-badge">{resetRequests.length}</span>
              : <span className="req-count-zero"> (없음)</span>}
          </h2>
          {loading ? <p className="admin-empty">불러오는 중...</p> :
           resetRequests.length === 0 ? <p className="admin-empty">현재 대기 중인 요청이 없습니다.</p> : (
            <div className="admin-list">
              {resetRequests.map(r => (
                <div key={r.id} className="admin-req-row">
                  <div className="req-info">
                    <span className="req-name">아이디: {r.username}</span>
                    {r.person_name && <span className="req-meta">이름: {r.person_name}</span>}
                    <span className="req-meta">연락 이메일: {r.contact_email}</span>
                    {r.message && <span className="req-meta req-message">💬 {r.message}</span>}
                    <span className="req-meta">{fmtDt(r.created_at)}</span>
                  </div>
                  <div className="req-btns">
                    <button className="btn-approve" onClick={async () => {
                      try {
                        await approvePasswordResetRequest(r.id, r.username, r.contact_email);
                        setResetRequests(prev => prev.filter(x => x.id !== r.id));
                        setActionMsg('초기화 링크가 이메일로 발송됐습니다.');
                        setTimeout(() => setActionMsg(''), 3000);
                      } catch {
                        setActionMsg('승인 처리 중 오류가 발생했습니다.');
                        setTimeout(() => setActionMsg(''), 3000);
                      }
                    }}>승인</button>
                    <button className="btn-reject" onClick={async () => {
                      await rejectPasswordResetRequest(r.id);
                      setResetRequests(prev => prev.filter(x => x.id !== r.id));
                    }}>거절</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 가족집단 목록 */}
        <section className="admin-section">
          <div className="member-header">
            <h2>👨‍👩‍👧‍👦 가족집단 ({families.length}개)</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="member-search"
                type="text"
                value={familyFilter}
                onChange={e => { setFamilyFilter(e.target.value); setFamilyPage(0); }}
                placeholder="이름 검색"
                style={{ width: 120 }}
              />
              <button className="btn-bulk-new" onClick={() => setBulkTarget('new')}>⬆ 새 가족 일괄 등록</button>
            </div>
          </div>
          {loading ? <p className="admin-empty">불러오는 중...</p> :
           filteredFamilies.length === 0 ? <p className="admin-empty">없음</p> : (
            <>
              <div className="admin-list">
                {pagedFamilies.map(f => (
                  <div key={f.familyId} className={`admin-fam-row ${f.disabled ? 'disabled' : ''}`}>
                    <div className="fam-info">
                      <span className="fam-root">👤 {f.rootName}</span>
                      {f.disabled && <span className="fam-badge disabled-badge">비활성</span>}
                      <span className="fam-id">{f.personCount}명</span>
                    </div>
                    <div className="fam-actions">
                      <button className="btn-enter"   onClick={() => handleEnterFamily(f)} disabled={f.disabled}>보기</button>
                      <button className="btn-export"  onClick={() => handleExport(f)} title="CSV 내보내기">⬇</button>
                      <button className="btn-upload"  onClick={() => setBulkTarget({ id: f.familyId, rootName: f.rootName })} title="일괄 등록">⬆</button>
                      <button className={f.disabled ? 'btn-enable' : 'btn-disable'} onClick={() => handleToggle(f)}>
                        {f.disabled ? '활성화' : '비활성화'}
                      </button>
                      <button className="btn-delete" onClick={() => setConfirmDelete(f)}>삭제</button>
                    </div>
                  </div>
                ))}
              </div>
              <AdminPager current={familyPage} total={totalFamilyPages} onChange={setFamilyPage} />
            </>
          )}
        </section>
        {/* 알림 발송 시간 (전역) */}
        <section className="admin-section">
          <h2>🔔 알림 발송 시간</h2>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 12px' }}>
            알림 시기·범위·종류는 각 회원의 My 페이지에서 개별 설정합니다.
          </p>
          {pushLoading ? <p className="admin-empty">불러오는 중...</p> : (
            <div className="push-settings">
              <div className="push-row">
                <label className="push-label">발송 시간 (KST)</label>
                <select className="push-select" value={pushSettings.sendHourKST}
                  onChange={e => setPushSettings({ sendHourKST: Number(e.target.value) })}>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </div>
              {pushSaveMsg && (
                <p className={`push-save-msg ${pushSaveMsg.ok ? 'ok' : 'err'}`}>{pushSaveMsg.msg}</p>
              )}
              <button className="push-save-btn" onClick={savePushSettings}>저장</button>
            </div>
          )}
        </section>
        {/* 활동 로그 */}
        <section className="admin-section">
          <div className="section-head">
            <h2>
              📝 활동 로그
              {actLogsLoaded && <span className="req-count-zero"> ({actLogs.length}건)</span>}
            </h2>
            <button className="btn-bulk-new" onClick={loadActLogs} disabled={actLogsLoading}>
              {actLogsLoading ? '로딩...' : actLogsLoaded ? '새로고침' : '불러오기'}
            </button>
          </div>
          {!actLogsLoaded ? (
            <p className="admin-empty">버튼을 눌러 로그를 불러오세요.</p>
          ) : actLogsLoading ? (
            <p className="admin-empty">불러오는 중...</p>
          ) : actLogs.length === 0 ? (
            <p className="admin-empty">활동 기록이 없습니다.</p>
          ) : (
            <>
              <div className="act-log-list">
                <div className="act-log-head">
                  <span>시간</span><span>작업</span><span>작업자</span><span>대상</span>
                </div>
                {actLogs.slice(actLogPage * ACT_LOG_PAGE_SIZE, (actLogPage + 1) * ACT_LOG_PAGE_SIZE).map(l => (
                  <div key={l.id} className="act-log-row">
                    <span className="act-log-time">{fmtDt(l.at)}</span>
                    <span className={`act-log-action ${l.action}`}>{l.action === 'add' ? '추가' : '삭제'}</span>
                    <span className="act-log-actor">{l.actor_name}</span>
                    <span className="act-log-target">{l.person_name}</span>
                  </div>
                ))}
              </div>
              <AdminPager
                current={actLogPage}
                total={Math.ceil(actLogs.length / ACT_LOG_PAGE_SIZE)}
                onChange={setActLogPage}
              />
            </>
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
                {searchResults.map(p => {
                  const famName = families.find(f => f.familyId === p.familyId)?.rootName;
                  return (
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
                      <span className="map-result-fid">
                        {famName ? `${famName} 가족` : p.familyId.slice(0, 8)}
                      </span>
                    </div>
                  );
                })}
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
            <div className="log-header">
              <h3>📋 {logMember.username} 접속 로그</h3>
              <button className="log-close-btn" onClick={() => setLogMember(null)}>✕</button>
            </div>
            {logsLoading ? (
              <p className="admin-empty">불러오는 중...</p>
            ) : loginLogs.length === 0 ? (
              <p className="admin-empty">접속 기록이 없습니다.</p>
            ) : (
              <div className="log-list">
                {loginLogs.map((l, i) => {
                  const deviceStr = parseUA(l.user_agent);
                  const isMobile  = /Android|iPhone|iPad/i.test(l.user_agent);
                  return (
                    <div key={l.id} className="log-row">
                      <span className="log-num">{i + 1}</span>
                      <span className="log-date">{fmtDt(l.logged_in_at)}</span>
                      <span className="log-device">{isMobile ? '📱' : '💻'} {deviceStr}</span>
                    </div>
                  );
                })}
              </div>
            )}
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
