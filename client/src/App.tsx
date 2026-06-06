import { useEffect, useRef, useState } from 'react';
import { useFamilyStore } from './store/familyStore';
import { FamilyTreeView } from './components/FamilyTreeView';
import { InvitePage } from './components/InvitePage';
import { InviteVerifyScreen } from './components/InviteVerifyScreen';
import { LoginScreen } from './components/LoginScreen';
import { RegisterScreen } from './components/RegisterScreen';
import { ForgotPasswordScreen } from './components/ForgotPasswordScreen';
import { ResetPasswordScreen } from './components/ResetPasswordScreen';
import { AnniversaryView } from './components/AnniversaryView';
import { SearchView } from './components/SearchView';
import { AdminView } from './components/AdminView';
import { NewFamilyRequestView } from './components/NewFamilyRequestView';
import { FamilyGroupRequestScreen } from './components/FamilyGroupRequestScreen';
import { GoogleLinkScreen } from './components/GoogleLinkScreen';
import { LandingPage } from './components/LandingPage';
import { MyMenuView } from './components/MyMenuView';
import { HelpView } from './components/HelpView';
import { InheritanceView } from './components/InheritanceView';
import { LS, SS } from './lib/storageKeys';
import { useFCMToken } from './hooks/useFCMToken';
import { useAdminEmail } from './hooks/useAdminEmail';
import { useIdleTimeout } from './hooks/useIdleTimeout';

import type { Member } from './types';
import './App.css';

const LS_USER_KEY     = LS.USER_NAME;
const LS_FAMILY_ID    = LS.FAMILY_ID;
const LS_IS_ADMIN     = LS.IS_ADMIN;
const LS_ADMIN_RETURN = LS.ADMIN_RETURN;
const LS_MEMBER_ID    = LS.MEMBER_ID;
export const LS_ACCOUNT_NAME = LS.ACCOUNT_NAME;

function App() {
  useFCMToken();

  const {
    init, loading, persons, updatePerson,
    setViewpoint, viewpointPersonId, currentFamilyId,
    loginMember, ensureAdminAccount, mapMemberToPerson, consumeInviteToken,
    loadInfoRequestsForMe,
    loginWithGoogle, linkGoogleToMember, registerWithGoogle,
    recordLogin, isFamilyDisabled,
    selectedPersonId, selectPerson,
    infoRequestPersonId, closeInfoRequest,
  } = useFamilyStore();

  const adminEmail = useAdminEmail();

  const [slowLoad,       setSlowLoad]       = useState(false);
  const [showIOSInstall, setShowIOSInstall] = useState(false);

  const isIOSSafari = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    && !/CriOS|FxiOS|OPiOS/i.test(navigator.userAgent)
    && !window.matchMedia('(display-mode: standalone)').matches
    && !(navigator as unknown as { standalone?: boolean }).standalone;

  // URL 파라미터 정리 (register)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('register')) {
      params.delete('register');
      const clean = window.location.pathname + (params.size ? '?' + params.toString() : '');
      window.history.replaceState({}, '', clean);
    }
  }, []);
  const [showAnniversary, setShowAnn]         = useState(false);
  const [showSearch,    setShowSearch]        = useState(false);
  const [showMyMenu,    setShowMyMenu]        = useState(false);
  const [showHelp,      setShowHelp]          = useState(false);
  const [showInheritance, setShowInheritance] = useState(false);
  const [showBackToast, setShowBackToast] = useState(false);
  const backPressedRef = useRef(false);
  const backTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingRequestCount, setPendingCount] = useState(0);
  const [loginError,    setLoginError]    = useState('');
  const [loginLoading,  setLoginLoading]  = useState(false);
  const [showLanding, setShowLanding] = useState(() => {
    const noUser   = !localStorage.getItem(LS_USER_KEY);
    const notAdmin = localStorage.getItem(LS_IS_ADMIN) !== 'true';
    const noRegister = !new URLSearchParams(window.location.search).has('register');
    const noInvite = !sessionStorage.getItem(SS.INVITE_PERSON_ID);
    return noUser && notAdmin && noRegister && noInvite;
  });

  const [showRegister,  setShowRegister]  = useState(() => {
    const noUser    = !localStorage.getItem(LS_USER_KEY);
    const notAdmin  = localStorage.getItem(LS_IS_ADMIN) !== 'true';
    const hasInvite = !!(
      sessionStorage.getItem(SS.INVITE_PERSON_ID) &&
      sessionStorage.getItem(SS.INVITE_FAMILY_ID)
    );
    // 초대 컨텍스트가 있으면 기존 로그인 상태 무관하게 가입 화면 표시
    return (noUser || hasInvite) && notAdmin && new URLSearchParams(window.location.search).has('register');
  });
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [pendingNewName, setPendingNew]         = useState<string | null>(null);
  const [registerSuccess, setRegSuccess]        = useState<string | null>(null);
  const [pendingInviteMemberId, setPendingInviteMemberId] = useState<string | null>(null);
  const [showFamilyGroupRequest, setShowFamilyGroupRequest] = useState(false);
  const [familyDisabled, setFamilyDisabled] = useState(false);
  const [googleLinkData, setGoogleLinkData] = useState<{
    uid: string; email: string; displayName: string;
  } | null>(null);

  const path        = window.location.pathname;
  const inviteMatch = path.match(/^\/invite\/(.+)$/);
  const resetMatch  = path.match(/^\/reset\/(.+)$/);

  const isAdmin       = localStorage.getItem(LS_IS_ADMIN) === 'true';

  // 앱 설치 후 서랍에서 열었을 때: 이전에 저장해 둔 초대 토큰이 있으면 invite 경로로 이동
  // sessionStorage에 이미 invite 컨텍스트가 있으면 InvitePage를 거친 정상 흐름 중이므로 스킵
  useEffect(() => {
    if (inviteMatch || isAdmin) return;
    const pending = localStorage.getItem(LS.PENDING_INVITE_TOKEN);
    const alreadyInFlow = !!sessionStorage.getItem(SS.INVITE_PERSON_ID);
    if (pending && !alreadyInFlow) window.location.replace(`/invite/${pending}`);
  }, []);
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

  // 열린 모달을 우선순위 순서로 닫는 함수 — ref로 관리해 popstate 핸들러가 항상 최신 상태를 읽음
  const closeTopModalRef = useRef<() => boolean>(() => false);
  useEffect(() => {
    closeTopModalRef.current = () => {
      if (showHelp)        { setShowHelp(false);                            return true; }
      if (showInheritance) { setShowInheritance(false);                     return true; }
      if (showAnniversary) { setShowAnn(false);                             return true; }
      if (showMyMenu)      { setShowMyMenu(false); setPendingCount(0);      return true; }
      if (showSearch)      { setShowSearch(false);                          return true; }
      if (infoRequestPersonId) { closeInfoRequest();                        return true; }
      if (selectedPersonId)    { selectPerson(null);                        return true; }
      return false;
    };
  }, [showHelp, showInheritance, showAnniversary, showMyMenu, showSearch, infoRequestPersonId, selectedPersonId,
      closeInfoRequest, selectPerson]);

  // 안드로이드 뒤로가기: 모달이 열려있으면 닫기, 없으면 이중 확인 후 종료
  useEffect(() => {
    const isMain = !needsLogin && !isAdmin && hasFamilyId;
    if (!isMain) return;

    history.pushState(null, '', window.location.href);

    const onPopState = () => {
      // 열린 모달이 있으면 닫고 히스토리 재삽입
      if (closeTopModalRef.current()) {
        history.pushState(null, '', window.location.href);
        return;
      }
      // 모달 없음 → 이중 확인 후 종료
      if (!backPressedRef.current) {
        history.pushState(null, '', window.location.href);
        backPressedRef.current = true;
        setShowBackToast(true);
        if (backTimerRef.current) clearTimeout(backTimerRef.current);
        backTimerRef.current = setTimeout(() => {
          backPressedRef.current = false;
          setShowBackToast(false);
        }, 2500);
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      if (backTimerRef.current) clearTimeout(backTimerRef.current);
    };
  }, [needsLogin, isAdmin, hasFamilyId]);

  useEffect(() => {
    if (!userName || isAdmin) return;
    // family_id 자체가 없는 경우: hard refresh 해도 즉시 신청 화면으로
    // pendingInviteMemberId가 있으면 초대 검증 중이므로 가족신청 화면으로 넘기지 않음
    if (!hasFamilyId && !showFamilyGroupRequest && !pendingInviteMemberId) {
      setShowFamilyGroupRequest(true);
      return;
    }
    if (loading) return;
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
  const applyMemberLogin = async (member: Member, displayName?: string) => {
    const invitePersonId   = sessionStorage.getItem(SS.INVITE_PERSON_ID);
    const invitePersonName = sessionStorage.getItem(SS.INVITE_PERSON_NAME);
    const inviteFamilyId   = sessionStorage.getItem(SS.INVITE_FAMILY_ID);

    if (member.family_id) {
      const disabled = await isFamilyDisabled(member.family_id);
      if (disabled) { setFamilyDisabled(true); return; }
    }

    if (!member.family_id || !member.person_id) {
      await recordLogin(member.id).catch(() => {});
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
    localStorage.setItem(LS.MY_PERSON_ID,  member.person_id);
    localStorage.setItem(LS_ACCOUNT_NAME,  member.username);
    sessionStorage.setItem(SS.VIEWPOINT_PERSON_ID, member.person_id);
    await recordLogin(member.id).catch(() => {}); // reload 전에 완료 보장
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
      if (member.is_admin) {
        localStorage.setItem(LS_IS_ADMIN, 'true');
        localStorage.setItem(LS_USER_KEY, member.username);
        localStorage.setItem(LS_MEMBER_ID, member.id);
        window.location.reload();
        return;
      }
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
    const res = await linkGoogleToMember(member.id, googleLinkData.uid, googleLinkData.email);
    if (!res.ok) {
      setLoginError(res.error ?? '구글 연결 중 오류가 발생했습니다.');
      setGoogleLinkData(null);
      return;
    }
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
    const inviteToken      = sessionStorage.getItem(SS.INVITE_TOKEN);
    const memberId         = localStorage.getItem(LS_MEMBER_ID)!;
    try {
      await mapMemberToPerson(memberId, invitePersonId, inviteFamilyId, invitePersonName);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'ALREADY_MAPPED') {
        alert('이 초대 링크는 이미 다른 계정에서 사용되었습니다. 관리자에게 문의하세요.');
      } else {
        alert('계정 연결 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
      return;
    }
    // 토큰 소비 — 재사용 방지
    if (inviteToken) await consumeInviteToken(inviteToken).catch(() => {});
    sessionStorage.removeItem(SS.INVITE_TOKEN);
    sessionStorage.removeItem(SS.INVITE_PERSON_ID);
    sessionStorage.removeItem(SS.INVITE_PERSON_NAME);
    sessionStorage.removeItem(SS.INVITE_FAMILY_ID);
    localStorage.removeItem(LS.PENDING_INVITE_TOKEN);
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
    localStorage.removeItem(LS.MY_PERSON_ID);
    localStorage.removeItem(LS_ACCOUNT_NAME);
    localStorage.removeItem(LS.GOOGLE_EMAIL);
    localStorage.removeItem(LS.PENDING_INVITE_TOKEN);
    sessionStorage.removeItem(SS.VIEWPOINT_PERSON_ID);
    window.location.reload();
  };

  const isLoggedIn = !!(userName && hasFamilyId);
  useIdleTimeout(handleLogout, isLoggedIn);

  // ── 라우팅 ────────────────────────────────────────────────────────────────────
  if (resetMatch)  return <ResetPasswordScreen token={resetMatch[1]} />;
  if (inviteMatch) return <InvitePage token={inviteMatch[1]} />;
  if (needsLogin && showLanding) return (
    <LandingPage
      onRegister={() => { setShowLanding(false); setShowRegister(true); }}
      onLogin={() => setShowLanding(false)}
    />
  );
  if (isAdmin) return (
    <AdminView onLogout={handleLogout} />
  );
  if (pendingNewName) return <NewFamilyRequestView requestedName={pendingNewName} onBack={() => setPendingNew(null)} />;

  if (googleLinkData) {
    return (
      <GoogleLinkScreen
        googleEmail={googleLinkData.email}
        displayName={googleLinkData.displayName}
        onLinkedToExisting={handleGoogleLinkedToExisting}
        onNewStart={handleGoogleNewStart}
        onCancel={() => setGoogleLinkData(null)}
      />
    );
  }

  if (familyDisabled) {
    return (
      <div className="family-disabled-screen">
        <div className="family-disabled-box">
          <p className="family-disabled-msg">가족 가계도가 관리자에 의해 접근이 금지되었습니다.</p>
          {adminEmail && (
            <a className="family-disabled-email" href={`mailto:${adminEmail}`}>{adminEmail}</a>
          )}
          <button className="family-disabled-logout" onClick={handleLogout}>로그아웃</button>
        </div>
      </div>
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

  if (showFamilyGroupRequest) {
    return (
      <FamilyGroupRequestScreen
        memberUsername={localStorage.getItem(LS_USER_KEY) ?? ''}
        onLogout={handleLogout}
      />
    );
  }

  if (showForgotPassword) {
    return <ForgotPasswordScreen onBack={() => setShowForgotPassword(false)} />;
  }

  if (showRegister) {
    return (
      <RegisterScreen
        onBack={() => { setShowRegister(false); setRegSuccess(null); setLoginError(''); }}
        onSuccess={(name) => {
          // Clear any active session so the newly registered user must log in fresh
          localStorage.removeItem(LS_USER_KEY);
          localStorage.removeItem(LS_FAMILY_ID);
          localStorage.removeItem(LS_MEMBER_ID);
          localStorage.removeItem(LS.MY_PERSON_ID);
          localStorage.removeItem(LS_ACCOUNT_NAME);
          setRegSuccess(name);
          setShowRegister(false);
        }}
        onGoogleLogin={handleGoogleLogin}
        googleError={loginError}
        googleLoading={loginLoading}
      />
    );
  }

  if (needsLogin) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        onGoogleLogin={handleGoogleLogin}
        onRegister={() => { setShowRegister(true); setLoginError(''); }}
        onForgotPassword={() => { setShowForgotPassword(true); setLoginError(''); }}
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
          <div className="logo-symbol">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              {/* 루트 */}
              <circle cx="10" cy="3.5" r="2.8" fill="white"/>
              {/* 루트→가로선 */}
              <line x1="10" y1="6.3" x2="10" y2="9" stroke="rgba(255,255,255,0.8)" strokeWidth="1.4" strokeLinecap="round"/>
              <line x1="4.5" y1="9" x2="15.5" y2="9" stroke="rgba(255,255,255,0.8)" strokeWidth="1.4" strokeLinecap="round"/>
              {/* 2세대 */}
              <line x1="4.5" y1="9" x2="4.5" y2="12" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="15.5" y1="9" x2="15.5" y2="12" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" strokeLinecap="round"/>
              <circle cx="4.5" cy="14" r="2.2" fill="white" opacity="0.9"/>
              <circle cx="15.5" cy="14" r="2.2" fill="white" opacity="0.9"/>
              {/* 3세대 */}
              <line x1="4.5" y1="16.2" x2="4.5" y2="17.5" stroke="rgba(255,255,255,0.6)" strokeWidth="1" strokeLinecap="round"/>
              <line x1="2" y1="17.5" x2="7" y2="17.5" stroke="rgba(255,255,255,0.6)" strokeWidth="1" strokeLinecap="round"/>
              <line x1="15.5" y1="16.2" x2="15.5" y2="17.5" stroke="rgba(255,255,255,0.6)" strokeWidth="1" strokeLinecap="round"/>
              <line x1="13" y1="17.5" x2="18" y2="17.5" stroke="rgba(255,255,255,0.6)" strokeWidth="1" strokeLinecap="round"/>
              <circle cx="2" cy="19" r="1.4" fill="white" opacity="0.75"/>
              <circle cx="7" cy="19" r="1.4" fill="white" opacity="0.75"/>
              <circle cx="13" cy="19" r="1.4" fill="white" opacity="0.75"/>
              <circle cx="18" cy="19" r="1.4" fill="white" opacity="0.75"/>
            </svg>
          </div>
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
          {isIOSSafari && (
            <button className="header-install-btn" onClick={() => setShowIOSInstall(true)}>
              📲 설치
            </button>
          )}
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
      {showInheritance && <InheritanceView onClose={() => setShowInheritance(false)} />}
      {showHelp        && <HelpView        onClose={() => setShowHelp(false)} />}
      {showBackToast && (
        <div className="back-exit-toast">한 번 더 누르면 앱을 종료합니다</div>
      )}
      {showIOSInstall && (
        <div className="ios-install-backdrop" onClick={() => setShowIOSInstall(false)}>
          <div className="ios-install-guide" onClick={e => e.stopPropagation()}>
            <button className="ios-install-close" onClick={() => setShowIOSInstall(false)}>✕</button>
            <div className="ios-install-icon">📲</div>
            <p className="ios-install-title">홈 화면에 추가</p>
            <ol className="ios-install-steps">
              <li>Safari 하단의 <strong>공유 버튼(□↑)</strong>을 누르세요</li>
              <li>스크롤해서 <strong>홈 화면에 추가</strong>를 선택하세요</li>
              <li>오른쪽 상단 <strong>추가</strong>를 눌러 완료하세요</li>
            </ol>
            <div className="ios-install-arrow-hint">↑ Safari 하단 공유 버튼</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
