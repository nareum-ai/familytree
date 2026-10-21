import { useState } from 'react';
import { buildInviteMessage } from '../lib/inviteMessage';
import './InviteLinkBox.css';

/** 생성된 초대 링크 표시 + 복사/공유 */
export function InviteLinkBox({ link, personName }: { link: string; personName: string }) {
  const [copyMsg, setCopyMsg] = useState('');

  const shareText = buildInviteMessage(personName);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(link);
    setCopyMsg('복사됨!');
    setTimeout(() => setCopyMsg(''), 2000);
  };

  const handleWebShare = async () => {
    if (!navigator.share) { handleCopy(); return; }
    try {
      await navigator.share({ title: '가족 가계도 초대', text: shareText, url: link });
    } catch { /* 취소 */ }
  };

  const handleSMSShare = () => {
    window.open(`sms:?body=${encodeURIComponent(`${shareText}\n${link}`)}`);
  };

  return (
    <div className="invite-box">
      <p className="invite-label">🔗 초대 링크 생성됨 <span className="invite-expiry">30일 유효</span></p>
      <div className="invite-desc-block">
        <p className="invite-desc-main">
          이 링크로 가입하면<br/>
          <strong className="invite-name-highlight">{personName}</strong>
          <span className="invite-desc-sub">으로 바로 가입됩니다</span>
        </p>
      </div>
      <div className="invite-link-row">
        <input readOnly value={link} className="invite-input" />
        <button className="btn-copy" onClick={handleCopy}>{copyMsg || '복사'}</button>
      </div>
      <div className="invite-share-row">
        <button className="invite-share-btn kakao" onClick={handleWebShare}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 1.5C4.86 1.5 1.5 4.08 1.5 7.26c0 2.04 1.35 3.84 3.39 4.86l-.87 3.24 3.78-2.49c.39.06.78.09 1.2.09 4.14 0 7.5-2.58 7.5-5.76S13.14 1.5 9 1.5z" fill="currentColor"/>
          </svg>
          카카오톡
        </button>
        <button className="invite-share-btn sms" onClick={handleSMSShare}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          문자
        </button>
      </div>
    </div>
  );
}
