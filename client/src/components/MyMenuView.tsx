import { useEffect, useState } from 'react';
import { useFamilyStore, type InfoRequestItem } from '../store/familyStore';
import { useAdminEmailStatus } from '../hooks/useAdminEmail';
import { LS, getCurrentUserName } from '../lib/storageKeys';
import { getMemberId, isAdminContext as checkAdminContext } from '../lib/session';
import { isStandalone as checkStandalone } from '../lib/device';
import { getMemberData } from '../lib/firestore';
import { enablePushOnDevice, isDeviceRegistered, notificationPermission, setPushEnabled } from '../lib/pushNotifications';
import { changePassword, linkGoogleAccount, unlinkGoogleFromMember } from '../services/authService';
import { FcmDebugPanel } from './FcmDebugPanel';
import { PushStatusPanel } from './PushStatusPanel';
import { NotifBlockedModal } from './NotifBlockedModal';
import { GoogleIcon } from './GoogleIcon';
import { getInstallPrompt, triggerInstall } from '../lib/installPrompt';
import { validateNewPassword } from '../utils/password';
import './MyMenuView.css';
import './NotifBlockedModal.css';
import { Icon } from './Icon';

interface Props { onClose: () => void; }

type Tab = 'requests' | 'password' | 'google';
type Msg = { ok: boolean; msg: string } | null;

export function MyMenuView({ onClose }: Props) {
  const persons = useFamilyStore(s => s.persons);
  const { loadInfoRequestsForMe, approveInfoRequest, rejectInfoRequest } = useFamilyStore.getState();
  const [tab, setTab]           = useState<Tab>('requests');
  const [requests, setRequests] = useState<InfoRequestItem[]>([]);
  const [reqLoading, setReqLoading] = useState(true);

  // 비밀번호 변경
  const [oldPw, setOldPw]    = useState('');
  const [newPw, setNewPw]    = useState('');
  const [confirmPw, setConf] = useState('');
  const [pwMsg, setPwMsg]    = useState<Msg>(null);
  const [pwLoading, setPwLoading] = useState(false);

  // 구글 연결
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [googleMsg, setGoogleMsg]     = useState<Msg>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { email: adminEmail, loading: adminEmailLoading } = useAdminEmailStatus();

  // PWA 설치
  const [installDismissed, setInstallDismissed] = useState(
    localStorage.getItem(LS.PWA_INSTALL_DISMISSED) === 'true'
  );
  const [hasInstallPrompt, setHasInstallPrompt] = useState(!!getInstallPrompt());
  const isStandalone = checkStandalone();

  // 알림 ON/OFF
  const [notifEnabled, setNotifEnabled] = useState<boolean | null>(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [showNotifBlocked, setShowNotifBlocked] = useState(false);
  const [notifTestPrompt, setNotifTestPrompt] = useState(false);
  const notifDenied = typeof Notification !== 'undefined' && Notification.permission === 'denied';
  // 설정값이 켜져 있어도 이 기기에 권한·토큰이 없으면 실제로는 못 받는다 → OFF로 표시
  const [deviceReady, setDeviceReady] = useState(isDeviceRegistered);
  const notifOn = !!notifEnabled && deviceReady;

  const username = getCurrentUserName() ?? '';

  // 관리자 or 관리자 대리 접속 중에는 구글·알림 탭 숨김
  const isAdminContext = checkAdminContext();

  useEffect(() => {
    loadInfoRequestsForMe()
      .then(setRequests)
      .catch(() => setRequests([]))
      .finally(() => setReqLoading(false));

    // 구글 연결 상태·알림 설정 로드
    const memberId = getMemberId();
    if (!memberId) return;
    getMemberData(memberId).then(data => {
      setGoogleEmail((data?.google_email as string | null) ?? null);
      const pp = data?.push_prefs as { enabled?: boolean } | undefined;
      setNotifEnabled(pp?.enabled !== false);
    });
  }, [loadInfoRequestsForMe]);

  // beforeinstallprompt: 전역에서 이미 캡처됨, 혹시 늦게 발생하면 여기서도 반영
  useEffect(() => {
    const handler = () => setHasInstallPrompt(true);
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const personName = (personId: string) =>
    persons.find(p => p.id === personId)?.name ?? '(비공개)';

  const handleApprove = async (req: InfoRequestItem) => {
    await approveInfoRequest(req.id, req.personId);
    setRequests(r => r.filter(x => x.id !== req.id));
  };

  const handleReject = async (req: InfoRequestItem) => {
    await rejectInfoRequest(req.id);
    setRequests(r => r.filter(x => x.id !== req.id));
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = validateNewPassword(newPw, confirmPw);
    setPwMsg(invalid ? { ok: false, msg: invalid } : null);
    if (invalid) return;
    setPwLoading(true);
    try {
      if (await changePassword(oldPw, newPw) === 'wrong-password') {
        setPwMsg({ ok: false, msg: '현재 비밀번호가 올바르지 않습니다.' });
        return;
      }
      setPwMsg({ ok: true, msg: '비밀번호가 변경됐습니다.' });
      setOldPw(''); setNewPw(''); setConf('');
    } catch {
      setPwMsg({ ok: false, msg: '변경 중 오류가 발생했습니다.' });
    } finally {
      setPwLoading(false);
    }
  };

  const handleLinkGoogle = async () => {
    const memberId = getMemberId();
    if (!memberId) return;
    setGoogleMsg(null);
    setGoogleLoading(true);
    try {
      const res = await linkGoogleAccount();
      if (!res) return; // 팝업 취소
      if (!res.ok) {
        setGoogleMsg({ ok: false, msg: res.error ?? '구글 연결 중 오류가 발생했습니다.' });
        return;
      }
      localStorage.setItem(LS.GOOGLE_EMAIL, res.email);
      setGoogleEmail(res.email);
      setGoogleMsg({ ok: true, msg: '구글 계정이 연결됐습니다.' });
    } catch {
      setGoogleMsg({ ok: false, msg: '구글 연결 중 오류가 발생했습니다.' });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleUnlinkGoogle = async () => {
    const memberId = getMemberId();
    if (!memberId) return;
    setGoogleMsg(null);
    setGoogleLoading(true);
    try {
      await unlinkGoogleFromMember();
      localStorage.removeItem(LS.GOOGLE_EMAIL);
      setGoogleEmail(null);
      setGoogleMsg({ ok: true, msg: '구글 연결이 해제됐습니다.' });
    } catch {
      setGoogleMsg({ ok: false, msg: '해제 중 오류가 발생했습니다.' });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleInstall = async () => {
    const accepted = await triggerInstall();
    if (accepted) setHasInstallPrompt(false);
  };

  const handleNotifToggle = async () => {
    if (notifLoading || notifEnabled === null) return;
    const memberId = getMemberId();
    if (!memberId) return;
    const turningOn = !notifOn;
    if (turningOn && (typeof Notification === 'undefined' || Notification.permission === 'denied')) {
      setShowNotifBlocked(true);
      return;
    }
    setNotifLoading(true);
    try {
      if (turningOn) {
        const { granted, testShown } = await enablePushOnDevice(memberId);
        if (!granted) {
          if (notificationPermission() === 'denied') setShowNotifBlocked(true);
          return;
        }
        setDeviceReady(isDeviceRegistered());
        if (testShown) setNotifTestPrompt(true);
      }
      await setPushEnabled(memberId, turningOn);
      setNotifEnabled(turningOn);
    } catch { /* ignore */ } finally {
      setNotifLoading(false);
    }
  };

  // 테스트 알림이 실제로는 안 보였다고 답한 경우 — 꺼진 게 사실이므로 토글도 OFF로 되돌린다
  const handleNotifTestFailed = async () => {
    setNotifTestPrompt(false);
    setShowNotifBlocked(true);
    const memberId = getMemberId();
    if (!memberId) return;
    try {
      await setPushEnabled(memberId, false);
      setNotifEnabled(false);
    } catch { /* ignore */ }
  };

  const showInstallBanner = hasInstallPrompt && !isStandalone && !installDismissed;

  return (
    <div className="my-backdrop" onClick={onClose}>
      <div className="my-panel" onClick={e => e.stopPropagation()}>
        <div className="my-header">
          <h2><Icon name="user" /> {username}</h2>
          <button className="my-close" onClick={onClose}>✕</button>
        </div>

        <div className="my-tabs">
          <button className={`my-tab ${tab === 'requests' ? 'active' : ''}`}
            onClick={() => setTab('requests')}>
            <Icon name="inbox" /> 정보공개 요청 {requests.length > 0 && <span className="my-badge">{requests.length}</span>}
          </button>
          <button className={`my-tab ${tab === 'password' ? 'active' : ''}`}
            onClick={() => setTab('password')}>
            <Icon name="lock" /> 비밀번호
          </button>
          {!isAdminContext && (
            <button className={`my-tab ${tab === 'google' ? 'active' : ''}`}
              onClick={() => setTab('google')}>
              <Icon name="link" /> 구글{googleEmail === null && <span className="my-badge my-badge-warn">!</span>}
            </button>
          )}
        </div>

        <div className="my-body">
          {/* 정보공개 요청 */}
          {tab === 'requests' && (
            reqLoading ? <p className="my-empty">불러오는 중...</p> :
            requests.length === 0 ? <p className="my-empty">받은 정보공개 요청이 없습니다.</p> : (
              <div className="my-req-list">
                {requests.map(req => (
                  <div key={req.id} className="my-req-row">
                    <div className="my-req-info">
                      <span className="my-req-name">{req.requesterName}님</span>
                      <span className="my-req-person">→ {personName(req.personId)} 정보 요청</span>
                      <span className="my-req-date">{new Date(req.createdAt).toLocaleDateString('ko-KR')}</span>
                    </div>
                    <div className="my-req-btns">
                      <button className="my-approve" onClick={() => handleApprove(req)}>수락</button>
                      <button className="my-reject"  onClick={() => handleReject(req)}>거절</button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* 비밀번호 변경 */}
          {tab === 'password' && (
            <form className="my-pw-form" onSubmit={handlePasswordChange}>
              <div className="my-field">
                <label>현재 비밀번호</label>
                <input type="password" value={oldPw}
                  onChange={e => setOldPw(e.target.value)} placeholder="현재 비밀번호" maxLength={50} />
              </div>
              <div className="my-field">
                <label>새 비밀번호</label>
                <input type="password" value={newPw}
                  onChange={e => setNewPw(e.target.value)} placeholder="6자 이상" maxLength={50} />
              </div>
              <div className="my-field">
                <label>새 비밀번호 확인</label>
                <input type="password" value={confirmPw}
                  onChange={e => setConf(e.target.value)} placeholder="비밀번호 재입력" maxLength={50} />
              </div>
              {pwMsg && <p className={`my-pw-msg ${pwMsg.ok ? 'ok' : 'err'}`}>{pwMsg.msg}</p>}
              <button type="submit" className="my-pw-btn" disabled={pwLoading || !oldPw || !newPw || !confirmPw}>
                {pwLoading ? '변경 중...' : '비밀번호 변경'}
              </button>
            </form>
          )}

          {/* 구글 연결 */}
          {tab === 'google' && (
            <div className="my-google-section">
              <div className="my-google-icon">
                <GoogleIcon size={32} />
              </div>

              {googleEmail ? (
                <>
                  <p className="my-google-status linked">연결됨</p>
                  <p className="my-google-email">{googleEmail}</p>
                  <p className="my-google-desc">이 구글 계정으로 로그인할 수 있습니다.</p>
                  {googleMsg && <p className={`my-pw-msg ${googleMsg.ok ? 'ok' : 'err'}`}>{googleMsg.msg}</p>}
                  <button
                    className="my-google-unlink-btn"
                    onClick={handleUnlinkGoogle}
                    disabled={googleLoading}
                  >
                    {googleLoading ? '처리 중...' : '구글 연결 해제'}
                  </button>
                </>
              ) : (
                <>
                  <p className="my-google-status">연결 안 됨</p>
                  <p className="my-google-desc">
                    구글 계정을 연결해두면<br/>
                    <strong>비밀번호를 잊어버려도</strong> 구글로 로그인할 수 있어요.
                  </p>
                  {googleMsg && <p className={`my-pw-msg ${googleMsg.ok ? 'ok' : 'err'}`}>{googleMsg.msg}</p>}
                  <button
                    className="my-google-link-btn"
                    onClick={handleLinkGoogle}
                    disabled={googleLoading}
                  >
                    {googleLoading ? '처리 중...' : '구글 계정 연결하기'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* 빠른 설정 */}
        {!isAdminContext && (
          <div className="my-quick-settings">
            {showInstallBanner && (
              <div className="my-install-row">
                <div className="my-install-info">
                  <span className="my-install-icon"><Icon name="install" /></span>
                  <div>
                    <p className="my-install-title">앱 설치</p>
                    <p className="my-install-desc">홈 화면에 추가하면 더 편리해요</p>
                  </div>
                </div>
                <div className="my-install-actions">
                  <button className="my-install-btn" onClick={handleInstall}>설치</button>
                  <button className="my-install-dismiss" onClick={() => {
                    localStorage.setItem(LS.PWA_INSTALL_DISMISSED, 'true');
                    setInstallDismissed(true);
                  }}>✕</button>
                </div>
              </div>
            )}

            {(notifEnabled !== null || notifDenied) && (
              <div className="my-notif-row">
                <div className="my-notif-info">
                  <span className="my-notif-icon">
                    {notifDenied ? <Icon name="bell-off" /> : <Icon name="bell" />}
                  </span>
                  <span className="my-notif-label">
                    기념일 알림
                    {notifDenied && (
                      <span className="my-notif-blocked-hint">차단됨</span>
                    )}
                  </span>
                </div>
                {!notifDenied && (
                  <button
                    className={`my-notif-toggle ${notifOn ? 'on' : ''}`}
                    onClick={handleNotifToggle}
                    disabled={notifLoading || notifEnabled === null}
                  >
                    {notifLoading || notifEnabled === null ? '...' : notifOn ? 'ON' : 'OFF'}
                  </button>
                )}
                {notifDenied && (
                  <button className="my-notif-toggle" onClick={() => setShowNotifBlocked(true)}>
                    {isStandalone ? '안내' : '설치'}
                  </button>
                )}
              </div>
            )}
            {notifTestPrompt && (
              <div className="my-notif-test-prompt">
                <p className="my-notif-test-q">방금 테스트 알림이 화면에 떴나요?</p>
                <div className="my-notif-test-actions">
                  <button
                    type="button"
                    className="my-notif-test-yes"
                    onClick={() => setNotifTestPrompt(false)}
                  >
                    네, 보였어요
                  </button>
                  <button
                    type="button"
                    className="my-notif-test-no"
                    onClick={handleNotifTestFailed}
                  >
                    아니요, 안 보여요
                  </button>
                </div>
              </div>
            )}

            {/* 수신 상태 · 서버 테스트 · Play 스토어 앱 */}
            {getMemberId() && <PushStatusPanel key={deviceReady ? 'r' : 'n'} memberId={getMemberId()!} />}

            {/* 알림 진단 */}
            <FcmDebugPanel />
          </div>
        )}

        {showNotifBlocked && <NotifBlockedModal onClose={() => setShowNotifBlocked(false)} />}

        {/* 문의 · 탈퇴 안내 */}
        <div className="my-contact-footer">
          <p className="my-contact-title">탈퇴 및 문의</p>
          <p className="my-contact-desc">
            계정 탈퇴는 관리자를 통해 처리됩니다.<br />
            탈퇴 요청 또는 문의사항은 아래 이메일로 연락주세요.
          </p>
          {adminEmail
            ? <a href={`mailto:${adminEmail}?subject=계정 탈퇴 요청`} className="my-contact-email">{adminEmail}</a>
            : <span className="my-contact-email" style={{ color: 'var(--text-4)' }}>{adminEmailLoading ? '이메일 불러오는 중...' : '관리자에게 직접 연락해 주세요.'}</span>
          }
        </div>
      </div>
    </div>
  );
}
