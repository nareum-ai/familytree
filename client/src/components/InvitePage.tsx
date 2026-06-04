import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { LS, SS } from '../lib/storageKeys';
import type { Person } from '../types';



function isInAppBrowser() {
  return /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\/|Twitter/i.test(navigator.userAgent);
}

function buildOpenInChromeUrl() {
  const path     = window.location.href.replace(/^https?:\/\//, '');
  const fallback = encodeURIComponent(window.location.href);
  return `intent://${path}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
}


interface Props { token: string; }

export function InvitePage({ token }: Props) {
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [senderName, setSenderName] = useState<string | null>(null);
  const [copied,     setCopied]     = useState(false);

  const inApp = isInAppBrowser();
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  // URL ?from= 파라미터에서 발신자 이름 읽기 (인앱 브라우저용 — Firestore 건너뜀)
  useEffect(() => {
    const from = new URLSearchParams(window.location.search).get('from');
    if (from) setSenderName(decodeURIComponent(from));
  }, []);

  useEffect(() => {
    // KakaoTalk 등 인앱 브라우저는 Firestore WebSocket이 차단돼 무한 로딩됨
    // → Firestore 호출 없이 즉시 렌더 (외부 브라우저 안내 화면으로 진입)
    if (isInAppBrowser()) {
      localStorage.setItem(LS.PENDING_INVITE_TOKEN, token);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const inviteSnap = await getDocs(
          query(collection(db, 'invites'), where('token', '==', token))
        );
        if (inviteSnap.empty) throw new Error('not found');
        const invite = inviteSnap.docs[0].data();

        setSenderName(invite.created_by ?? null);

        const personsAll = await getDocs(collection(db, 'persons'));
        const allPersons = personsAll.docs.map(d => ({
          ...(d.data() as Omit<Person, 'id'>), id: d.id,
        }));
        const person = allPersons.find(p => p.id === invite.person_id) ?? null;
        if (!person) throw new Error('person not found');

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
  }, [token]);

  if (loading) return <div className="invite-loading">초대 정보를 불러오는 중...</div>;
  if (error) return (
    <div className="invite-landing">
      <div className="invite-card">
        <div className="invite-icon">❌</div>
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
        <div className="invite-icon">👨‍👩‍👧‍👦</div>
        <h1 className="invite-title">가계도 초대</h1>
        <p className="invite-desc">
          <strong>{senderName ?? '누군가'}님</strong>이 가계도에 초대했습니다.<br />
          가입 후 본인 확인 절차가 있습니다.
        </p>

        {inApp ? (
          <div className="invite-inapp-warn">
            <p>카카오톡에서는 구글 로그인이 불가합니다.<br />
            아래 버튼으로 {isIOS ? <strong>Safari</strong> : <strong>Chrome</strong>}에서 열어주세요.</p>
            {isIOS ? (
              <>
                <button
                  className="invite-inapp-btn"
                  style={copied ? { background: '#16A34A' } : {}}
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
                  🌐 Chrome으로 열기
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
              가입 후 본인 이름을 확인하는 절차가 있습니다.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
