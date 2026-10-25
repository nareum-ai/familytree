import { useEffect, useState } from 'react';
import { doc, getDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { findDocs } from '../lib/firestore';
import { isInAppBrowser, isIOS as detectIOS, isKakaoTalk, openInExternalBrowserFromKakao } from '../lib/device';
import { LS, SS } from '../lib/storageKeys';
import { getMyPersonId, getUserName } from '../lib/session';
import type { Person } from '../types';
import { Icon } from './Icon';
import { canonicalInviteUrl } from '../lib/inviteMessage';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function buildOpenInChromeUrl() {
  const path     = window.location.href.replace(/^https?:\/\//, '');
  const fallback = encodeURIComponent(window.location.href);
  return `intent://${path}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
}


interface Props { token: string; }

export function InvitePage({ token }: Props) {
  const inApp = isInAppBrowser();
  const isIOS = detectIOS();
  const kakao = isKakaoTalk();

  // KakaoTalk 등 인앱 브라우저는 Firestore WebSocket이 차단돼 무한 로딩됨
  // → Firestore 호출 없이 즉시 렌더 (외부 브라우저 안내 화면으로 진입)
  const [loading,    setLoading]    = useState(!inApp);
  const [error,      setError]      = useState<string | null>(null);
  // URL ?from= 파라미터에서 발신자 이름 읽기 (인앱 브라우저용 — Firestore 건너뜀)
  const [senderName, setSenderName] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get('from'));
  const [errDetail,  setErrDetail]  = useState('');
  const [retryKey,   setRetryKey]   = useState(0);
  const [canRetry,   setCanRetry]   = useState(false);
  const [usedInvite, setUsedInvite] = useState(false);
  const [copied,     setCopied]     = useState(false);

  useEffect(() => {
    // 주소창 URL을 정상 형태로 정리 (오염된 토큰 경로 교정)
    const clean = canonicalInviteUrl(token);
    if (clean !== window.location.href) window.history.replaceState({}, '', clean);

    if (inApp) {
      localStorage.setItem(LS.PENDING_INVITE_TOKEN, token);
      // 카카오톡은 외부 브라우저 열기 스킴을 지원 → 버튼 누를 필요 없이 바로 넘김
      if (kakao) openInExternalBrowserFromKakao(clean);
      return;
    }
    setLoading(true); setError(null); setCanRetry(false); setUsedInvite(false);
    // 이 브라우저에 이미 로그인된 가족 구성원인지
    const loggedIn = !!(getUserName() && localStorage.getItem(LS.FAMILY_ID));
    const goHome = () => {
      localStorage.removeItem(LS.PENDING_INVITE_TOKEN);
      window.location.replace('/');
    };
    (async () => {
      try {
        // 앱 전환 직후엔 네트워크가 늦게 붙어 Firestore가 실패할 수 있음 → 재시도
        let inviteSnap;
        for (let i = 0; ; i++) {
          try { inviteSnap = await findDocs('invites', where('token', '==', token)); break; }
          catch (e) { if (i >= 3) throw e; await sleep(1000 * (i + 1)); }
        }
        if (inviteSnap.empty) {
          // 예전 방식(사용 후 삭제)으로 처리된 초대일 수 있음 — 로그인 상태면 그냥 홈으로
          if (loggedIn) { goHome(); return; }
          throw new Error('not found');
        }
        const invite = inviteSnap.docs[0].data();

        // 내 인물에 대한 초대 → 이미 가입한 본인이 다시 누른 것
        if (loggedIn && invite.person_id === getMyPersonId()) { goHome(); return; }

        // 이미 사용된 초대이거나, 해당 인물에 연결된 계정이 이미 있음
        const mapped = invite.used_at ? null
          : await findDocs('members', where('person_id', '==', invite.person_id));
        if (invite.used_at || (mapped && !mapped.empty)) {
          if (loggedIn) { goHome(); return; }
          throw new Error('used');
        }

        setSenderName(invite.created_by ?? null);

        const personSnap = await getDoc(doc(db, 'persons', invite.person_id as string));
        if (!personSnap.exists()) throw new Error('person not found');
        const person = { ...(personSnap.data() as Omit<Person, 'id'>), id: personSnap.id };

        // 초대 컨텍스트 저장 — sessionStorage(현재 탭)와 localStorage(앱 설치 후 재진입 대비)
        sessionStorage.setItem(SS.INVITE_TOKEN,       token);
        sessionStorage.setItem(SS.INVITE_PERSON_ID,   person.id);
        sessionStorage.setItem(SS.INVITE_PERSON_NAME, person.name);
        sessionStorage.setItem(SS.INVITE_FAMILY_ID,   person.family_id ?? 'main');
        localStorage.setItem(LS.PENDING_INVITE_TOKEN, token);

        // 기존 viewpoint 세션 초기화 (새 사용자가 링크를 따라온 것)
        sessionStorage.removeItem(SS.VIEWPOINT_PERSON_ID);
      } catch (e) {
        const msg  = e instanceof Error ? e.message : String(e);
        const code = (e as { code?: string })?.code;
        setErrDetail(`${code ?? msg} · ${token.slice(0, 8)}`);
        if (msg === 'used') {
          setUsedInvite(true);
          setErrDetail('');
          setError('이미 가입이 완료된 초대 링크예요.\n가입하신 계정으로 로그인해 주세요.');
          localStorage.removeItem(LS.PENDING_INVITE_TOKEN);
        } else if (msg === 'not found' || msg === 'person not found') {
          setError('유효하지 않은 초대 링크입니다.\n이미 가입하셨다면 로그인해 주세요.');
          localStorage.removeItem(LS.PENDING_INVITE_TOKEN);
        } else {
          // 네트워크/서버 오류 — 토큰은 지우지 않음
          setError('초대 정보를 불러오지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.');
          setCanRetry(true);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [token, inApp, kakao, retryKey]);

  if (loading) return <div className="invite-loading">초대 정보를 불러오는 중...</div>;
  if (error) return (
    <div className="invite-landing">
      <div className="invite-card">
        <div className="invite-icon"><Icon name={usedInvite ? 'family' : 'cancel'} /></div>
        <h1 className="invite-title">{usedInvite ? '이미 가입하셨어요' : '초대 링크 오류'}</h1>
        <p className="invite-desc" style={{ whiteSpace: 'pre-line' }}>{error}</p>
        {errDetail && <p className="invite-note" style={{ opacity: 0.6, fontSize: 'var(--fs-12)' }}>오류 정보: {errDetail}</p>}
        <div className="invite-btn-group">
          {canRetry && (
            <button className="invite-view-btn" onClick={() => setRetryKey(k => k + 1)}>
              다시 시도
            </button>
          )}
          {!canRetry && (
            <button className="invite-view-btn" onClick={() => { window.location.href = '/'; }}>
              로그인하기
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const handleCopy = () => {
    const url = window.location.href;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {});
  };


  return (
    <div className="invite-landing">
      <div className="invite-card">
        <div className="invite-icon"><Icon name="family" /></div>
        <h1 className="invite-title">가계도 초대</h1>
        <p className="invite-desc">
          <strong>{senderName ?? '누군가'}님</strong>이 가계도에 초대했습니다.<br />
          가입하면 바로 가족 가계도를 볼 수 있어요.
        </p>

        {inApp ? (
          <div className="invite-inapp-warn">
            <p>이 앱 안에서는 가입이 어렵습니다.<br />
            아래 버튼으로 {isIOS ? <strong>Safari</strong> : <strong>Chrome</strong>}에서 열어주세요.</p>
            {kakao ? (
              <button className="invite-inapp-btn" onClick={() => openInExternalBrowserFromKakao()}>
                <Icon name="globe" /> {isIOS ? 'Safari로' : '브라우저로'} 열기
              </button>
            ) : isIOS ? (
              <>
                <button
                  className="invite-inapp-btn"
                  style={copied ? { background: '#3F7D4F' } : {}}
                  onClick={handleCopy}
                >
                  {copied ? '복사됨 ✓' : '링크 복사'}
                </button>
                <p className="invite-inapp-hint">
                  ① 위 버튼으로 링크 복사<br />
                  ② Safari 주소창에 붙여넣기
                </p>
              </>
            ) : (
              <>
                <button className="invite-inapp-btn" onClick={() => { window.location.href = buildOpenInChromeUrl(); }}>
                  <Icon name="globe" /> Chrome으로 열기
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="invite-btn-group">
              <button className="invite-view-btn" onClick={() => { window.location.href = '/?register=1'; }}>
                가입하기
              </button>
            </div>
            <p className="invite-note">
              Google 계정이나 아이디로 간단히 가입할 수 있어요.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
