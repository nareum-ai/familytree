import { useState } from 'react';

function isInAppBrowser() {
  return /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\/|Twitter/i.test(navigator.userAgent);
}

const DotsIcon = () => (
  <svg width="8" height="12" viewBox="0 0 4 12" fill="currentColor"
    style={{ display: 'inline', verticalAlign: 'middle' }}>
    <circle cx="2" cy="1.5"  r="1.3"/>
    <circle cx="2" cy="6"    r="1.3"/>
    <circle cx="2" cy="10.5" r="1.3"/>
  </svg>
);

function Banner() {
  const [copied, setCopied] = useState(false);
  const url   = window.location.href;
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  const handleCopy = () => {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {});
  };

  const handleAndroidExternal = () => {
    const intentUrl = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;action=android.intent.action.VIEW;end`;
    window.location.href = intentUrl;
    setTimeout(() => { navigator.clipboard?.writeText(url).catch(() => {}); }, 500);
  };

  return (
    <div className="inapp-banner">
      <p className="inapp-banner-msg">
        구글 로그인을 하려면<br />
        <strong>{isIOS ? 'Safari' : 'Chrome'}</strong>에서 열어야 합니다.
      </p>
      {isIOS ? (
        <>
          <button
            className="inapp-open-btn"
            style={copied ? { background: '#16A34A' } : {}}
            onClick={handleCopy}
          >
            {copied ? '복사됨 ✓' : '링크 복사'}
          </button>
          <p className="inapp-banner-hint">
            ① 위 버튼으로 링크 복사<br />
            ② Safari 주소창에 붙여넣기
          </p>
        </>
      ) : (
        <>
          <button className="inapp-open-btn" onClick={handleAndroidExternal}>
            Chrome으로 열기
          </button>
          <p className="inapp-banner-hint">
            안 열리면 카카오톡 하단 메뉴 버튼 (<DotsIcon />)<br />
            → 다른 브라우저로 열기
          </p>
        </>
      )}
    </div>
  );
}

export { isInAppBrowser };
export default Banner;
