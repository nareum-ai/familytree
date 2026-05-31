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
import { GoogleLinkScreen } from './components/GoogleLinkScreen';
import { MyMenuView } from './components/MyMenuView';
import { HelpView } from './components/HelpView';
import { LS, SS } from './lib/storageKeys';
import type { Member } from './types';
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
    loginWithGoogle, linkGoogleToMember, registerWithGoogle,
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
  const [googleLinkData, setGoogleLinkData] = useState<{
    uid: string; email: string; displayName: string;
  } | null>(null);

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

  useEffect(() => {
    if (!userName || isAdmin || !hasFamilyId) return;
    const check = () => loadInfoRequestsForMe()
      .then(r => setPendingCount(r.length))
      .catch(() => {});
    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [userName, hasFamilyId]);

  useEffect(() => {
    if (isAdmin) return;
    const unsub = init();
    const timer = setTimeout(() => setSlowLoad(true), 3000);
    return () => { unsub(); clearTimeout(timer); };
  }, [currentFamilyId]);

  useEffect(() => {
    if (!userName || loading || isAdmin) return;
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

  // ── 로그인 처리 (공통) ──────────────────────────────────────────────────────
  const applyMemberLogin = (member: Member, displayName?: string) => {
    const invitePersonId   = sessionStorage.getItem(SS.INVITE_PERSON_ID);
    const invitePersonName = sessionStorage.getItem(SS.INVITE_PERSON_NAME);
    const inviteFamilyId   = sessionStorage.getItem(SS.INVITE_FAMILY_ID);

    if (!member.family_id || !member.person_id) {
      if (invitePersonId && invitePersonName && inviteFamilyId) {
        localStorage.setItem(LS_USER_KEY,  member.person_name ?? displayName ?? member.username);
        localStorage.setItem(LS_MEMBER_ID, member.id);
        setPendingInviteMemberId(member.id);
        return;
      }
      localStorage.setItem(LS_USER_KEY,      member.person_name ?? displayName ?? member.username);
      localStorage.setItem(LS_MEMBER_ID,     member.id);
      localStorage.setItem(LS_ACCOUNT_NAME,  member.username);
      setShowFamilyGroupRequest(true);
      return;
    }
    localStorage.setItem(LS_USER_KEY,      member.person_name ?? displayName ?? member.username);
    localStorage.setItem(LS_FAMILY_ID,     member.family_id);
    localStorage.setItem(LS_MEMBER_ID,     member.id);
    localStorage.setItem(LS_ACCOUNT_NAME,  member.username);
    sessionStorage.setItem(SS.VIEWPOINT_PERSON_ID, member.person_id);
    window.location.reload();
  };

  // ── 아이디/비밀번호 로그인 ──────────────────────────────────────────────────
  const handleLogin = async (username: string, password: string) => {
    setLoginError('');
    setLoginLoading(true);
    try {
      const member = await loginMember(username, password);
      if (!member) { setLoginError('아이디 또는 비밀번호가 올바르지 않습니다.'); return; }
      if (member.status === 'suspended') { setLoginError('계정이 정지되었습니다. 관리자에게 문의하세요.'); return; }
      if (member.is_admin) {
        localStorage.setItem(LS_IS_ADMIN, 'true');
        localStorage.setItem(LS_USER_KEY, username);
        localStorage.setItem(LS_MEMBER_ID, member.id);
        window.location.reload();
        return;
      }
      applyMemberLogin(member);
    } finally {
      setLoginLoading(false);
    }
  };

  // ── 구글 로그인 ──────────────────────────────────────────────────────────────
  const handleGoogleLogin = async () => {
    setLoginError('');
    setLoginLoading(true);
    try {
      const result = await loginWithGoogle();
      if (!result) return; // 팝업 취소
      const { member, googleUid, googleEmail, displayName } = result;

      if (!member) {
        // 초대 링크 컨텍스트가 있으면 바로 계정 생성 → InviteVerifyScreen
        const hasInvite = !!(
          sessionStorage.getItem(SS.INVITE_PERSON_ID) &&
          sessionStorage.getItem(SS.INVITE_FAMILY_ID)
        );
        if (hasInvite) {
          const newMember = await registerWithGoogle(googleUid, googleEmail, displayName);
          localStorage.setItem(LS.GOOGLE_EMAIL, googleEmail);
          applyMemberLogin(newMember, displayName);
          return;
        }
        // 일반 신규 구글 사용자 → 기존 계정 연결 or 새로 시작 화면
        setGoogleLinkData({ uid: googleUid, email: googleEmail, displayName });
        return;
      }
      if (member.status === 'suspended') { setLoginError('계정이 정지되었습니다. 관리자에게 문의하세요.'); return; }

      localStorage.setItem(LS.GOOGLE_EMAIL, googleEmail);
      applyMemberLogin(member, displayName);
    } catch {
      setLoginError('구글 로그인 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoginLoading(false);
    }
  };

  // ── 구글 → 기존 계정 연결 완료 ─────────────────────────────────────────────
  const handleGoogleLinkedToExisting = async (member: Member) => {
    if (!googleLinkData) return;
    await linkGoogleToMember(member.id, googleLinkData.uid, googleLinkData.email);
    localStorage.setItem(LS.GOOGLE_EMAIL, googleLinkData.email);
    setGoogleLinkData(null);
    applyMemberLogin(member, googleLinkData.displayName);
  };

  // ── 구글 → 새로 시작 ────────────────────────────────────────────────────────
  const handleGoogleNewStart = async () => {
    if (!googleLinkData) return;
    const member = await registerWithGoogle(
      googleLinkData.uid, googleLinkData.email, googleLinkData.displayName
    );
    localStorage.setItem(LS.GOOGLE_EMAIL, googleLinkData.email);
    setGoogleLinkData(null);
    applyMemberLogin(member, googleLinkData.displayName);
  };

  // ── 초대 이름 검증 성공 ─────────────────────────────────────────────────────
  const handleInviteVerified = async () => {
    const invitePersonId   = sessionStorage.getItem(SS.INVITE_PERSON_ID)!;
    const invitePersonName = sessionStorage.getItem(SS.INVITE_PERSON_NAME)!;
    const inviteFamilyId   = sessionStorage.getItem(SS.INVITE_FAMILY_ID)!;
    const memberId         = localStorage.getItem(LS_MEMBER_ID)!;
    await mapMemberToPerson(memberId, invitePersonId, inviteFamilyId, invitePersonName);
    sessionStorage.removeItem(SS.INVITE_PERSON_ID);
    sessionStorage.removeItem(SS.INVITE_PERSON_NAME);
    sessionStorage.removeItem(SS.INVITE_FAMILY_ID);
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
    localStorage.removeItem(LS.GOOGLE_EMAIL);
    sessionStorage.removeItem(SS.VIEWPOINT_PERSON_ID);
    window.location.reload();
  };

  // ── 라우팅 ────────────────────────────────────────────────────────────────────
  if (inviteMatch) return <InvitePage token={inviteMatch[1]} />;
  if (isAdmin) return <AdminView onLogout={handleLogout} />;
  if (pendingNewName) return <NewFamilyRequestView requestedName={pendingNewName} onBack={() => setPendingNew(null)} />;

  if (googleLinkData) {
    return (
      <GoogleLinkScreen
        googleEmail={googleLinkData.email}
        googleUid={googleLinkData.uid}
        displayName={googleLinkData.displayName}
        onLinkedToExisting={handleGoogleLinkedToExisting}
        onNewStart={handleGoogleNewStart}
        onCancel={() => setGoogleLinkData(null)}
      />
    );
  }

  if (showFamilyGroupRequest) {
    return (
      <FamilyGroupRequestScreen
        memberUsername={localStorage.getItem(LS_USER_KEY) ?? ''}
        onLogout={handleLogout}
      />
    );
  }

  if (pendingInviteMemberId) {
    const invitePersonName = sessionStorage.getItem(SS.INVITE_PERSON_NAME) ?? '';
    const memberUsername   = localStorage.getItem(LS_USER_KEY) ?? '';
    return (
      <InviteVerifyScreen
        invitePersonName={invitePersonName}
        memberUsername={memberUsername}
        onConfirm={handleInviteVerified}
        onCancel={() => { setPendingInviteMemberId(null); handleLogout(); }}
      />
    );
  }

  if (showRegister) {
    return (
      <RegisterScreen
        onBack={() => { setShowRegister(false); setRegSuccess(null); }}
        onSuccess={(name) => { setRegSuccess(name); setShowRegister(false); }}
      />
    );
  }

  if (needsLogin) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        onGoogleLogin={handleGoogleLogin}
        onRegister={() => setShowRegister(true)}
        success={registerSuccess ? '가입이 완료됐습니다. 아이디로 로그인하세요.' : undefined}
        error={loginError}
        loading={loginLoading}
      />
    );
  }

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
          <div className="header-nav-buttons">
            <button className="header-ann-btn header-my-btn" onClick={() => setShowMyMenu(true)} title="My 메뉴">
              👤{pendingRequestCount > 0 && <span className="header-notify-dot">{pendingRequestCount}</span>}
            </button>
            <button className="header-ann-btn" onClick={() => setShowSearch(true)} title="검색">🔍</button>
            <button className="header-ann-btn" onClick={() => setShowAnn(true)} title="기념일">📅</button>
            <button className="header-ann-btn" onClick={() => setShowHelp(true)} title="사용 안내">❓</button>
          </div>
          <span className="header-username">{displayName}</span>
          <button className="header-logout" onClick={handleLogout}>로그아웃</button>
        </div>
      </header>
      <main className="app-main">
        <FamilyTreeView />
      </main>
      <nav className="mobile-bottom-nav">
        <button className="mobile-nav-btn" onClick={() => setShowMyMenu(true)}>
          <span className="mobile-nav-icon">
            👤{pendingRequestCount > 0 && <span className="mobile-notify-dot">{pendingRequestCount}</span>}
          </span>
          <span className="mobile-nav-label">My</span>
        </button>
        <button className="mobile-nav-btn" onClick={() => setShowSearch(true)}>
          <span className="mobile-nav-icon">🔍</span>
          <span className="mobile-nav-label">검색</span>
        </button>
        <button className="mobile-nav-btn" onClick={() => setShowAnn(true)}>
          <span className="mobile-nav-icon">📅</span>
          <span className="mobile-nav-label">기념일</span>
        </button>
        <button className="mobile-nav-btn" onClick={() => setShowHelp(true)}>
          <span className="mobile-nav-icon">❓</span>
          <span className="mobile-nav-label">도움말</span>
        </button>
      </nav>
      {showMyMenu      && <MyMenuView      onClose={() => { setShowMyMenu(false); setPendingCount(0); }} />}
      {showSearch      && <SearchView      onClose={() => setShowSearch(false)} />}
      {showAnniversary && <AnniversaryView onClose={() => setShowAnn(false)} />}
      {showHelp        && <HelpView        onClose={() => setShowHelp(false)} />}
    </div>
  );
}

export default App;
