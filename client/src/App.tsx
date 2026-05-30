import { useEffect, useState } from 'react';
import { useFamilyStore } from './store/familyStore';
import { FamilyTreeView } from './components/FamilyTreeView';
import { InvitePage } from './components/InvitePage';
import { InviteVerifyScreen } from './components/InviteVerifyScreen';
import { LoginScreen } from './components/LoginScreen';
import { RegisterScreen } from './components/RegisterScreen';
import { AnniversaryView } from './components/AnniversaryView';
import { SearchView } from './components/SearchView';
import { AdminView } from './components/AdminView';
import { NewFamilyRequestView } from './components/NewFamilyRequestView';
import { FamilyGroupRequestScreen } from './components/FamilyGroupRequestScreen';
import { MyMenuView } from './components/MyMenuView';
import { HelpView } from './components/HelpView';
import { LS, SS } from './lib/storageKeys';
import './App.css';

const LS_USER_KEY     = LS.USER_NAME;
const LS_FAMILY_ID    = LS.FAMILY_ID;
const LS_IS_ADMIN     = LS.IS_ADMIN;
const LS_ADMIN_RETURN = LS.ADMIN_RETURN;
const LS_MEMBER_ID    = LS.MEMBER_ID;
export const LS_ACCOUNT_NAME = LS.ACCOUNT_NAME;

function App() {
  const {
    init, loading, persons, updatePerson,
    setViewpoint, viewpointPersonId, currentFamilyId,
    loginMember, ensureAdminAccount, mapMemberToPerson,
    loadInfoRequestsForMe,
  } = useFamilyStore();

  const [slowLoad,      setSlowLoad]      = useState(false);
  const [showAnniversary, setShowAnn]     = useState(false);
  const [showSearch,    setShowSearch]    = useState(false);
  const [showMyMenu,    setShowMyMenu]    = useState(false);
  const [showHelp,      setShowHelp]      = useState(false);
  const [pendingRequestCount, setPendingCount] = useState(0);
  const [loginError,    setLoginError]    = useState('');
  const [loginLoading,  setLoginLoading]  = useState(false);
  const [showRegister,  setShowRegister]  = useState(false);
  const [pendingNewName, setPendingNew]         = useState<string | null>(null);
  const [registerSuccess, setRegSuccess]        = useState<string | null>(null);
  const [pendingInviteMemberId, setPendingInviteMemberId] = useState<string | null>(null);
  const [showFamilyGroupRequest, setShowFamilyGroupRequest] = useState(false);

  const path        = window.location.pathname;
  const inviteMatch = path.match(/^\/invite\/(.+)$/);

  const isAdmin       = localStorage.getItem(LS_IS_ADMIN) === 'true';
  const isAdminReturn = localStorage.getItem(LS_ADMIN_RETURN) === 'true';
  const userName      = localStorage.getItem(LS_USER_KEY);
  const hasFamilyId   = !!localStorage.getItem(LS_FAMILY_ID);

  const needsLogin = !inviteMatch && !isAdmin && !userName;

  useEffect(() => {
    ensureAdminAccount();
  }, []);

  // 미처리 정보공개 요청 수 주기적 체크 (로그인 상태에서만)
  useEffect(() => {
    if (!userName || isAdmin || !hasFamilyId) return;
    const check = () => loadInfoRequestsForMe()
      .then(r => setPendingCount(r.length))
      .catch(() => {});
    check();
    const interval = setInterval(check, 60_000); // 1분마다
    return () => clearInterval(interval);
  }, [userName, hasFamilyId]);

  // 가족트리 로드
  useEffect(() => {
    if (isAdmin) return;
    const unsub = init();
    const timer = setTimeout(() => setSlowLoad(true), 3000);
    return () => { unsub(); clearTimeout(timer); };
  }, [currentFamilyId]);

  // 뷰포인트 결정
  useEffect(() => {
    if (!userName || loading || isAdmin) return;

    // 가족트리가 비어있으면 (삭제됐거나 잘못된 family_id) → 가족그룹 요청 화면
    if (persons.length === 0 && hasFamilyId && !showFamilyGroupRequest) {
      setShowFamilyGroupRequest(true);
      return;
    }

    const root = persons.find(p => p.is_root === 1);
    if (!root) return;
    if (root.name === '나') { updatePerson(root.id, { name: userName }); return; }
    if (root.name === userName) { if (viewpointPersonId) setViewpoint(null); return; }
    if (!sessionStorage.getItem(SS.VIEWPOINT_PERSON_ID)) {
      const matched = persons.find(p => p.name === userName && p.is_root !== 1);
      if (matched) setViewpoint(matched.id);
    }
  }, [userName, loading]);

  // ── 로그인 처리 ────────────────────────────────────────────────────────────
  const handleLogin = async (username: string, password: string) => {
    setLoginError('');
    setLoginLoading(true);
    try {
      const member = await loginMember(username, password);
      if (!member) {
        setLoginError('아이디 또는 비밀번호가 올바르지 않습니다.');
        return;
      }
      if (member.status === 'suspended') {
        setLoginError('계정이 정지되었습니다. 관리자에게 문의하세요.');
        return;
      }
      if (member.is_admin) {
        localStorage.setItem(LS_IS_ADMIN, 'true');
        localStorage.setItem(LS_USER_KEY, username);
        localStorage.setItem(LS_MEMBER_ID, member.id);
        window.location.reload();
        return;
      }
      // 아직 매핑 안 된 경우 → 초대 링크 컨텍스트 확인
      if (!member.family_id || !member.person_id) {
        const invitePersonId   = sessionStorage.getItem(SS.INVITE_PERSON_ID);
        const invitePersonName = sessionStorage.getItem(SS.INVITE_PERSON_NAME);
        const inviteFamilyId   = sessionStorage.getItem(SS.INVITE_FAMILY_ID);

        if (invitePersonId && invitePersonName && inviteFamilyId) {
          // 초대 링크가 있으면 이름 검증 화면으로
          localStorage.setItem(LS_USER_KEY, username);
          localStorage.setItem(LS_MEMBER_ID, member.id);
          setPendingInviteMemberId(member.id);
          return;
        }

        // 초대 링크도 없고 매핑도 안 됨 → 가족그룹 생성 신청 화면
        localStorage.setItem(LS_USER_KEY, username);
        localStorage.setItem(LS_MEMBER_ID, member.id);
        setShowFamilyGroupRequest(true);
        return;
      }
      // 매핑된 가족트리 로드
      localStorage.setItem(LS_USER_KEY,      member.person_name ?? username);
      localStorage.setItem(LS_FAMILY_ID,     member.family_id);
      localStorage.setItem(LS_MEMBER_ID,     member.id);
      localStorage.setItem(LS_ACCOUNT_NAME,  username);   // 계정 아이디 별도 저장
      sessionStorage.setItem(SS.VIEWPOINT_PERSON_ID, member.person_id);
      window.location.reload();
    } finally {
      setLoginLoading(false);
    }
  };

  // 초대 이름 검증 성공 → 회원을 해당 인물에 매핑
  const handleInviteVerified = async () => {
    const invitePersonId   = sessionStorage.getItem(SS.INVITE_PERSON_ID)!;
    const invitePersonName = sessionStorage.getItem(SS.INVITE_PERSON_NAME)!;
    const inviteFamilyId   = sessionStorage.getItem(SS.INVITE_FAMILY_ID)!;
    const memberId         = localStorage.getItem(LS_MEMBER_ID)!;

    await mapMemberToPerson(memberId, invitePersonId, inviteFamilyId, invitePersonName);

    // 초대 컨텍스트 정리
    sessionStorage.removeItem(SS.INVITE_PERSON_ID);
    sessionStorage.removeItem(SS.INVITE_PERSON_NAME);
    sessionStorage.removeItem(SS.INVITE_FAMILY_ID);

    // 매핑된 인물로 로그인
    localStorage.setItem(LS_USER_KEY, invitePersonName);
    localStorage.setItem(LS_FAMILY_ID, inviteFamilyId);
    sessionStorage.setItem(SS.VIEWPOINT_PERSON_ID, invitePersonId);
    setPendingInviteMemberId(null);
    window.location.reload();
  };

  const handleLogout = () => {
    localStorage.removeItem(LS_USER_KEY);
    localStorage.removeItem(LS_IS_ADMIN);
    localStorage.removeItem(LS_FAMILY_ID);
    localStorage.removeItem(LS_ADMIN_RETURN);
    localStorage.removeItem(LS_MEMBER_ID);
    localStorage.removeItem(LS_ACCOUNT_NAME);
    sessionStorage.removeItem(SS.VIEWPOINT_PERSON_ID);
    window.location.reload();
  };

  // ── Invite ──────────────────────────────────────────────────────────────────
  if (inviteMatch) return <InvitePage token={inviteMatch[1]} />;

  // ── 어드민 ──────────────────────────────────────────────────────────────────
  if (isAdmin) return <AdminView onLogout={handleLogout} />;

  // ── 새 가족집단 요청 ────────────────────────────────────────────────────────
  if (pendingNewName) {
    return <NewFamilyRequestView requestedName={pendingNewName} onBack={() => setPendingNew(null)} />;
  }

  // ── 가족그룹 생성 신청 화면 (초대 없이 가입한 경우) ─────────────────────────
  if (showFamilyGroupRequest) {
    return (
      <FamilyGroupRequestScreen
        memberUsername={localStorage.getItem(LS_USER_KEY) ?? ''}
        onLogout={handleLogout}
      />
    );
  }

  // ── 초대 이름 검증 화면 ────────────────────────────────────────────────────
  if (pendingInviteMemberId) {
    const invitePersonName = sessionStorage.getItem(SS.INVITE_PERSON_NAME) ?? '';
    const memberUsername   = localStorage.getItem(LS_USER_KEY) ?? '';
    return (
      <InviteVerifyScreen
        invitePersonName={invitePersonName}
        memberUsername={memberUsername}
        onConfirm={handleInviteVerified}
        onCancel={() => {
          setPendingInviteMemberId(null);
          handleLogout();
        }}
      />
    );
  }

  // ── 회원가입 ────────────────────────────────────────────────────────────────
  if (showRegister) {
    return (
      <RegisterScreen
        onBack={() => { setShowRegister(false); setRegSuccess(null); }}
        onSuccess={(name) => { setRegSuccess(name); setShowRegister(false); }}
      />
    );
  }

  // ── 로그인 화면 ─────────────────────────────────────────────────────────────
  if (needsLogin) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        onRegister={() => setShowRegister(true)}
        error={registerSuccess
          ? `✅ 가입이 정상처리 되었습니다. 가입하신 아이디로 로그인 하세요.`
          : loginError}
        loading={loginLoading}
      />
    );
  }

  // ── 로딩 ─────────────────────────────────────────────────────────────────────
  if (loading && hasFamilyId) {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <p>가계도를 불러오는 중...</p>
        {slowLoad && <p className="loading-slow">서버 연결 중입니다. 잠시만 기다려주세요...</p>}
      </div>
    );
  }

  const displayName = viewpointPersonId
    ? persons.find(p => p.id === viewpointPersonId)?.name ?? userName
    : userName;

  // ── 메인 앱 ──────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-logo">
          <span className="logo-icon">🌳</span>
          <span className="logo-text">우리 가족 가계도</span>
        </div>
        <div className="header-user">
          {isAdminReturn && (
            <button className="header-ann-btn" title="관리자로 돌아가기" onClick={() => {
              localStorage.removeItem(LS_USER_KEY);
              localStorage.removeItem(LS_FAMILY_ID);
              localStorage.removeItem(LS_ADMIN_RETURN);
              localStorage.setItem(LS_IS_ADMIN, 'true');
              window.location.reload();
            }}>🛡️</button>
          )}
          <button className="header-ann-btn header-my-btn" onClick={() => setShowMyMenu(true)} title="My 메뉴">
            👤{pendingRequestCount > 0 && <span className="header-notify-dot">{pendingRequestCount}</span>}
          </button>
          <button className="header-ann-btn" onClick={() => setShowSearch(true)} title="검색">🔍</button>
          <button className="header-ann-btn" onClick={() => setShowAnn(true)} title="기념일">📅</button>
          <button className="header-ann-btn" onClick={() => setShowHelp(true)} title="사용 안내">❓</button>
          <span className="header-username">{displayName}</span>
          <button className="header-logout" onClick={handleLogout}>로그아웃</button>
        </div>
      </header>
      <main className="app-main">
        <FamilyTreeView />
      </main>
      {showMyMenu      && <MyMenuView      onClose={() => { setShowMyMenu(false); setPendingCount(0); }} />}
      {showSearch      && <SearchView      onClose={() => setShowSearch(false)} />}
      {showAnniversary && <AnniversaryView onClose={() => setShowAnn(false)} />}
      {showHelp        && <HelpView        onClose={() => setShowHelp(false)} />}
    </div>
  );
}

export default App;
