import { useEffect, useState } from 'react';
import { doc, getDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { findDocs } from '../lib/firestore';
import { isInAppBrowser, isIOS as detectIOS, isKakaoTalk, openInExternalBrowserFromKakao } from '../lib/device';
import { LS, SS } from '../lib/storageKeys';
import type { Person } from '../types';
import { Icon } from './Icon';

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
  const [senderName, setSenderName] = useState<string | null>(() => {
    const from = new URLSearchParams(window.location.search).get('from');
    return from ? decodeURIComponent(from) : null;
  });
  const [copied,     setCopied]     = useState(false);

  useEffect(() => {
    if (inApp) {
      localStorage.setItem(LS.PENDING_INVITE_TOKEN, token);
      // 카카오톡은 외부 브라우저 열기 스킴을 지원 → 버튼 누를 필요 없이 바로 넘김
      if (kakao) openInExternalBrowserFromKakao();
      return;
    }
    (async () => {
      try {
        const inviteSnap = await findDocs('invites', where('token', '==', token));
        if (inviteSnap.empty) throw new Error('not found');
        const invite = inviteSnap.docs[0].data();

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
      } catch {
        setError('유효하지 않은 초대 링크입니다.');
        localStorage.removeItem(LS.PENDING_INVITE_TOKEN);
      } finally {
        setLoading(false);
      }
    })();
  }, [token, inApp, kakao]);

  if (loading) return <div className="invite-loading">초대 정보를 불러오는 중...</div>;
  if (error) return (
    <div className="invite-landing">
      <div className="invite-card">
        <div className="invite-icon"><Icon name="cancel" /></div>
        <h1 className="invite-title">초대 링크 오류</h1>
        <p className="invite-desc">{error}</p>
        <div className="invite-btn-group">
          <button className="invite-view-btn" onClick={() => { window.location.href = '/'; }}>
            홈으로 이동
          </button>
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
