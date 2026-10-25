import { useEffect, useRef, useState, type ComponentType } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useFamilyStore } from './store/familyStore';
import { FamilyTreeView } from './components/FamilyTreeView';
import { InvitePage } from './components/InvitePage';
import { extractInviteToken } from './lib/inviteMessage';
import { InviteVerifyScreen } from './components/InviteVerifyScreen';
import { LoginScreen } from './components/LoginScreen';
import { RegisterScreen } from './components/RegisterScreen';
import { ForgotPasswordScreen } from './components/ForgotPasswordScreen';
import { ResetPasswordScreen } from './components/ResetPasswordScreen';
import { AnniversaryView } from './components/AnniversaryView';
import { SearchView } from './components/SearchView';
import { AdminView } from './components/AdminView';
import { FamilyGroupRequestScreen } from './components/FamilyGroupRequestScreen';
import { GoogleLinkScreen } from './components/GoogleLinkScreen';
import { LandingPage } from './components/LandingPage';
import { MyMenuView } from './components/MyMenuView';
import { HelpView } from './components/HelpView';
import { AIView } from './components/AIView';
import { InviteFamilyView } from './components/InviteFamilyView';
import { AppHeader, MobileBottomNav, type AppView } from './components/AppHeader';
import { IOSInstallGuide } from './components/IOSInstallGuide';
import { LS, SS } from './lib/storageKeys';
import { canAddToHomeScreenIOS } from './lib/device';
import {
  clearInviteContext, clearSession, clearUserIdentity, getInviteContext, getMemberId, getUserName,
  hasInviteContext, isAdminReturn as checkAdminReturn, isAdminSession, returnToAdmin,
  startAdminSession, startFamilySession,
} from './lib/session';
import {
  consumeInviteToken, ensureAdminAccount, isFamilyDisabled, linkGoogleToMember, loginMember,
  loginWithGoogle, mapMemberToPerson, recordLogin, registerWithGoogle,
} from './services/authService';
import { useFCMToken, useForegroundPush } from './hooks/useFCMToken';
import { ForegroundPushToast, PushPermissionPrompt } from './components/PushPermissionPrompt';
import { NotifBlockedModal } from './components/NotifBlockedModal';
import './components/NotifBlockedModal.css';
import { useAdminEmail } from './hooks/useAdminEmail';
import { useIdleTimeout } from './hooks/useIdleTimeout';
import { useBackButton } from './hooks/useBackButton';

import type { Member } from './types';
import './App.css';

const SLOW_LOAD_MS = 3000;
const PENDING_REQUEST_POLL_MS = 60_000;
const SUSPENDED_MSG = '계정이 정지되었습니다. 관리자에게 문의하세요.';

const VIEWS: Record<AppView, ComponentType<{ onClose: () => void }>> = {
  my:          MyMenuView,
  search:      SearchView,
  anniversary: AnniversaryView,
  invite:      InviteFamilyView,
  ai:          AIView,
  help:        HelpView,
};

const hasRegisterParam = () => new URLSearchParams(window.location.search).has('register');

function logout() {
  clearSession();
  window.location.reload();
}

function FamilyDisabledScreen({ adminEmail }: { adminEmail: string | null }) {
  return (
    <div className="family-disabled-screen">
      <div className="family-disabled-box">
        <p className="family-disabled-msg">가족 가계도가 관리자에 의해 접근이 금지되었습니다.</p>
        {adminEmail && (
          <a className="family-disabled-email" href={`mailto:${adminEmail}`}>{adminEmail}</a>
        )}
        <button className="family-disabled-logout" onClick={logout}>로그아웃</button>
      </div>
    </div>
  );
}

function App() {
  useFCMToken(getMemberId());
  const [foregroundPush, dismissForegroundPush] = useForegroundPush();

  const { init, loading, persons, viewpointPersonId, currentFamilyId,
          selectedPersonId, infoRequestPersonId } = useFamilyStore(
    useShallow(s => ({
      init: s.init, loading: s.loading, persons: s.persons,
      viewpointPersonId: s.viewpointPersonId, currentFamilyId: s.currentFamilyId,
      selectedPersonId: s.selectedPersonId, infoRequestPersonId: s.infoRequestPersonId,
    }))
  );
  const { updatePerson, setViewpoint, selectPerson, closeInfoRequest, loadInfoRequestsForMe } = useFamilyStore.getState();

  const adminEmail = useAdminEmail();

  // ── 세션 정보 (로그인 상태 변경은 항상 페이지 reload로 반영됨) ─────────────
  const path        = window.location.pathname;
  const inviteMatch = path.match(/^\/invite\/(.+)$/);
  const resetMatch  = path.match(/^\/reset\/(.+)$/);
  const isInviteRoute = !!inviteMatch;
  const isAdmin       = isAdminSession();
  const isAdminReturn = checkAdminReturn();
  const userName      = getUserName();
  const hasFamilyId   = !!localStorage.getItem(LS.FAMILY_ID);
  const needsLogin    = !isInviteRoute && !isAdmin && !userName;
  const isLoggedIn    = !!(userName && hasFamilyId);

  const [slowLoad,       setSlowLoad]       = useState(false);
  const [showIOSInstall, setShowIOSInstall] = useState(false);
  const [showNotifBlocked, setShowNotifBlocked] = useState(false);
  const [activeView,     setActiveView]     = useState<AppView | null>(null);
  const [pendingRequestCount, setPendingCount] = useState(0);
  const [loginError,    setLoginError]    = useState('');
  const [loginLoading,  setLoginLoading]  = useState(false);
  const [showLanding, setShowLanding] = useState(() =>
    !userName && !isAdmin && !hasRegisterParam() && !sessionStorage.getItem(SS.INVITE_PERSON_ID)
  );
  // 초대 컨텍스트가 있으면 기존 로그인 상태 무관하게 가입 화면 표시
  const [showRegister, setShowRegister] = useState(() =>
    (!userName || hasInviteContext()) && !isAdmin && hasRegisterParam()
  );
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [registerSuccess, setRegSuccess]        = useState<string | null>(null);
  const [pendingInviteMemberId, setPendingInviteMemberId] = useState<string | null>(null);
  const [familyGroupRequested, setFamilyGroupRequested] = useState(false);
  const [familyDisabled, setFamilyDisabled] = useState(false);
  const [googleSigningIn, setGoogleSigningIn] = useState(false);
  const [googleLinkData, setGoogleLinkData] = useState<{
    uid: string; email: string; displayName: string;
  } | null>(null);

  // 가족 미배정 계정 → 가족집단 신청 화면
  // (초대 검증 중이면 신청 화면으로 넘기지 않음 — 렌더 순서상 초대 검증 화면이 먼저)
  const showFamilyGroupRequest = familyGroupRequested || (
    !!userName && !isAdmin && !pendingInviteMemberId &&
    (!hasFamilyId || (!loading && persons.length === 0))
  );

  // URL 파라미터 정리 (register)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('register')) {
      params.delete('register');
      const clean = window.location.pathname + (params.size ? '?' + params.toString() : '');
      window.history.replaceState({}, '', clean);
    }
  }, []);

  // 앱 설치 후 서랍에서 열었을 때: 이전에 저장해 둔 초대 토큰이 있으면 invite 경로로 이동
  // sessionStorage에 이미 invite 컨텍스트가 있으면 InvitePage를 거친 정상 흐름 중이므로 스킵
  useEffect(() => {
    if (isInviteRoute || isAdmin) return;
    const pending = localStorage.getItem(LS.PENDING_INVITE_TOKEN);
    const alreadyInFlow = !!sessionStorage.getItem(SS.INVITE_PERSON_ID);
    if (pending && !alreadyInFlow) window.location.replace(`/invite/${pending}`);
  }, [isInviteRoute, isAdmin]);

  useEffect(() => {
    ensureAdminAccount();
  }, []);

  // 내가 권한자인 정보공개 요청 건수 (헤더 배지)
  useEffect(() => {
    if (!userName || isAdmin || !hasFamilyId) return;
    const check = () => loadInfoRequestsForMe()
      .then(r => setPendingCount(r.length))
      .catch(() => {});
    check();
    const interval = setInterval(check, PENDING_REQUEST_POLL_MS);
    return () => clearInterval(interval);
  }, [userName, isAdmin, hasFamilyId, loadInfoRequestsForMe]);

  useEffect(() => {
    if (isAdmin) return;
    const unsub = init();
    const timer = setTimeout(() => setSlowLoad(true), SLOW_LOAD_MS);
    return () => { unsub(); clearTimeout(timer); };
  }, [currentFamilyId, isAdmin, init]);

  // 초기 로드 완료 시 1회: 루트 이름 보정 및 뷰포인트 결정
  const viewpointSyncedRef = useRef(false);
  useEffect(() => {
    if (!userName || isAdmin || !hasFamilyId || loading || viewpointSyncedRef.current) return;
    viewpointSyncedRef.current = true;
    const root = persons.find(p => p.is_root === 1);
    if (!root) return;
    if (root.name === '나') { updatePerson(root.id, { name: userName }); return; }
    if (root.name === userName) { if (viewpointPersonId) setViewpoint(null); return; }
    if (!sessionStorage.getItem(SS.VIEWPOINT_PERSON_ID)) {
      const matched = persons.find(p => p.name === userName && p.is_root !== 1);
      if (matched) setViewpoint(matched.id);
    }
  }, [userName, isAdmin, hasFamilyId, loading, persons, viewpointPersonId, updatePerson, setViewpoint]);

  const closeView = () => {
    if (activeView === 'my') setPendingCount(0);
    setActiveView(null);
  };

  // 안드로이드 뒤로가기: 열린 모달을 우선순위 순서로 닫기
  const showBackToast = useBackButton(!needsLogin && !isAdmin && hasFamilyId, () => {
    if (activeView)          { closeView();          return true; }
    if (infoRequestPersonId) { closeInfoRequest();   return true; }
    if (selectedPersonId)    { selectPerson(null);   return true; }
    return false;
  });

  // 모듈 함수라 렌더마다 참조가 바뀌지 않음 → idle 타이머가 매 렌더 재등록되지 않는다
  const handleLogout = logout;
  useIdleTimeout(handleLogout, isLoggedIn);

  // ── 로그인 처리 (공통) ──────────────────────────────────────────────────────
  const applyMemberLogin = async (member: Member, displayName?: string) => {
    const userDisplayName = member.person_name ?? displayName ?? member.username;

    // 정지 확인과 로그인 기록은 서로 무관 → 동시에 보내 서버 왕복을 한 번으로 줄임
    const [disabled] = await Promise.all([
      member.family_id ? isFamilyDisabled(member.family_id) : Promise.resolve(false),
      recordLogin(member.id).catch(() => {}),
    ]);
    if (disabled) {
      setFamilyDisabled(true);
      return;
    }

    if (!member.family_id || !member.person_id) {
      localStorage.setItem(LS.USER_NAME, userDisplayName);
      localStorage.setItem(LS.MEMBER_ID, member.id);
      const invite = getInviteContext();
      if (invite.personId && invite.personName && invite.familyId) {
        setPendingInviteMemberId(member.id);
        return;
      }
      localStorage.setItem(LS.ACCOUNT_NAME, member.username);
      setFamilyGroupRequested(true);
      return;
    }

    startFamilySession({
      userName: userDisplayName,
      familyId: member.family_id,
      personId: member.person_id,
      memberId: member.id,
      accountName: member.username,
    });
    // 페이지 reload 없이 바로 가계도로 전환 — 앱 재시작·서버 재연결 시간을 아낀다
    // (App은 세션 값을 렌더마다 localStorage에서 읽으므로 store만 새 가족으로 맞추면 됨)
    setShowRegister(false);
    setShowForgotPassword(false);
    useFamilyStore.setState({
      currentFamilyId: member.family_id,
      viewpointPersonId: member.person_id,
      persons: [], relationships: [], loading: true,
    });
  };

  /** 정지·관리자 계정 처리 후 일반 로그인 진행 */
  const loginAs = async (member: Member, adminUsername: string, displayName?: string) => {
    if (member.status === 'suspended') { setLoginError(SUSPENDED_MSG); return; }
    if (member.is_admin) {
      startAdminSession(adminUsername, member.id);
      window.location.reload();
      return;
    }
    await applyMemberLogin(member, displayName);
  };

  // ── 아이디/비밀번호 로그인 ──────────────────────────────────────────────────
  const handleLogin = async (username: string, password: string) => {
    setLoginError('');
    setLoginLoading(true);
    try {
      const member = await loginMember(username, password);
      if (!member) { setLoginError('아이디 또는 비밀번호가 올바르지 않습니다.'); return; }
      await loginAs(member, username);
    } finally {
      setLoginLoading(false);
    }
  };

  // ── 구글 로그인 ──────────────────────────────────────────────────────────────
  const handleGoogleLogin = async () => {
    setLoginError('');
    setLoginLoading(true);
    try {
      // 계정 선택이 끝나면 로그인 화면 대신 로딩 화면 표시
      const result = await loginWithGoogle(() => setGoogleSigningIn(true));
      if (!result) return; // 팝업 취소
      const { member, googleUid, googleEmail, displayName } = result;

      if (!member) {
        // 초대 링크 컨텍스트가 있으면 바로 계정 생성 → InviteVerifyScreen
        if (hasInviteContext()) {
          const newMember = await registerWithGoogle(googleUid, googleEmail, displayName);
          localStorage.setItem(LS.GOOGLE_EMAIL, googleEmail);
          await applyMemberLogin(newMember, displayName);
          return;
        }
        // 일반 신규 구글 사용자 → 기존 계정 연결 or 새로 시작 화면
        setGoogleLinkData({ uid: googleUid, email: googleEmail, displayName });
        return;
      }
      if (member.status !== 'suspended') localStorage.setItem(LS.GOOGLE_EMAIL, googleEmail);
      await loginAs(member, member.username, displayName);
    } catch {
      setLoginError('구글 로그인 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoginLoading(false);
      setGoogleSigningIn(false);
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
    const member = await registerWithGoogle(googleLinkData.uid, googleLinkData.email, googleLinkData.displayName);
    localStorage.setItem(LS.GOOGLE_EMAIL, googleLinkData.email);
    setGoogleLinkData(null);
    applyMemberLogin(member, googleLinkData.displayName);
  };

  // ── 초대 이름 검증 성공 ─────────────────────────────────────────────────────
  const handleInviteVerified = async () => {
    const invite = getInviteContext();
    const personId   = invite.personId!;
    const personName = invite.personName!;
    const familyId   = invite.familyId!;
    try {
      await mapMemberToPerson(getMemberId()!, personId, familyId, personName);
    } catch (e: unknown) {
      const alreadyMapped = e instanceof Error && e.message === 'ALREADY_MAPPED';
      alert(alreadyMapped
        ? '이 초대 링크는 이미 다른 계정에서 사용되었습니다. 관리자에게 문의하세요.'
        : '계정 연결 중 오류가 발생했습니다. 다시 시도해주세요.');
      return;
    }
    // 토큰 소비 — 재사용 방지
    if (invite.token) await consumeInviteToken(invite.token).catch(() => {});
    clearInviteContext();
    localStorage.setItem(LS.USER_NAME, personName);
    localStorage.setItem(LS.FAMILY_ID, familyId);
    sessionStorage.setItem(SS.VIEWPOINT_PERSON_ID, personId);
    setPendingInviteMemberId(null);
    window.location.reload();
  };

  // ── 라우팅 ────────────────────────────────────────────────────────────────────
  if (resetMatch)  return <ResetPasswordScreen token={resetMatch[1]} />;
  if (inviteMatch) return <InvitePage token={extractInviteToken(inviteMatch[1])} />;
  if (needsLogin && showLanding) return (
    <LandingPage
      onRegister={() => { setShowLanding(false); setShowRegister(true); }}
      onLogin={() => setShowLanding(false)}
    />
  );
  const foregroundToast = foregroundPush && (
    <ForegroundPushToast key={foregroundPush.id} title={foregroundPush.title} body={foregroundPush.body} onClose={dismissForegroundPush} />
  );

  if (isAdmin) return <><AdminView onLogout={handleLogout} />{foregroundToast}</>;

  if (googleSigningIn) {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <p>로그인 중...</p>
      </div>
    );
  }

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

  if (familyDisabled) return <FamilyDisabledScreen adminEmail={adminEmail} />;

  if (pendingInviteMemberId) {
    return (
      <InviteVerifyScreen
        invitePersonName={getInviteContext().personName ?? ''}
        memberUsername={getUserName() ?? ''}
        onConfirm={handleInviteVerified}
        onCancel={() => { setPendingInviteMemberId(null); handleLogout(); }}
      />
    );
  }

  if (showFamilyGroupRequest) {
    return <FamilyGroupRequestScreen memberUsername={getUserName() ?? ''} onLogout={handleLogout} />;
  }

  if (showForgotPassword) {
    return <ForgotPasswordScreen onBack={() => setShowForgotPassword(false)} />;
  }

  if (showRegister) {
    return (
      <RegisterScreen
        onBack={() => { setShowRegister(false); setRegSuccess(null); setLoginError(''); }}
        onSuccess={(name, password) => {
          // 기존 세션 정리 후 방금 만든 계정으로 바로 로그인 (재입력 없이 초대 확인/가족 신청으로 진행)
          clearUserIdentity();
          setRegSuccess(name);
          setShowRegister(false);
          handleLogin(name, password);
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
        success={registerSuccess ? '가입이 완료됐습니다.' : undefined}
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

  const ActiveView = activeView ? VIEWS[activeView] : null;

  // 알림 켜기 안내: 본인 인물이 매핑된 일반 회원만 (관리자 대리 접속 제외)
  const memberIdForPush = getMemberId();
  const pushMemberId = memberIdForPush && !isAdminReturn && localStorage.getItem(LS.MY_PERSON_ID)
    ? memberIdForPush : null;

  // ── 메인 앱 ──────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <AppHeader
        displayName={displayName}
        pendingRequestCount={pendingRequestCount}
        onOpen={setActiveView}
        onLogout={handleLogout}
        onReturnToAdmin={isAdminReturn ? () => { returnToAdmin(); window.location.reload(); } : undefined}
        onShowIOSInstall={canAddToHomeScreenIOS() ? () => setShowIOSInstall(true) : undefined}
      />
      <main className="app-main">
        <FamilyTreeView />
      </main>
      <MobileBottomNav pendingRequestCount={pendingRequestCount} onOpen={setActiveView} />
      {ActiveView && <ActiveView onClose={closeView} />}
      {showBackToast && (
        <div className="back-exit-toast">한 번 더 누르면 앱을 종료합니다</div>
      )}
      {showIOSInstall && <IOSInstallGuide onClose={() => setShowIOSInstall(false)} />}
      {pushMemberId && (
        <PushPermissionPrompt
          memberId={pushMemberId}
          onBlocked={() => setShowNotifBlocked(true)}
          onIOSInstall={() => setShowIOSInstall(true)}
        />
      )}
      {showNotifBlocked && <NotifBlockedModal onClose={() => setShowNotifBlocked(false)} />}
      {foregroundToast}
    </div>
  );
}

export default App;
