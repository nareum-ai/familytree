import { useState } from 'react';
import { GoogleIcon } from './GoogleIcon';
import { LS } from '../lib/storageKeys';
import { isInAppBrowser } from '../lib/device';
import { linkGoogleAccount } from '../services/authService';
import './PushPermissionPrompt.css';

const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

/** 아이디·비밀번호로 로그인한 Google 미연결 회원에게 연결 안내를 띄울지 */
export function shouldSuggestGoogleLink(member: { google_uid?: string | null; is_admin?: boolean }): boolean {
  if (member.google_uid || member.is_admin || isInAppBrowser()) return false;
  const until = Number(localStorage.getItem(LS.GOOGLE_LINK_PROMPT_SNOOZED_UNTIL) ?? 0);
  return Date.now() >= until;
}

interface Props {
  onClose: () => void;
}

/**
 * Google 연결 안내 배너 — 연결하면 다음부터 아이디·비밀번호 없이 버튼 한 번으로 로그인.
 * "나중에"는 30일간 다시 띄우지 않는다.
 */
export function GoogleLinkPrompt({ onClose }: Props) {
  const [busy, setBusy]   = useState(false);
  const [done, setDone]   = useState(false);
  const [error, setError] = useState('');

  const link = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await linkGoogleAccount();
      if (!res) return; // 팝업 취소
      if (!res.ok) { setError(res.error ?? 'Google 연결 중 오류가 발생했습니다.'); return; }
      localStorage.setItem(LS.GOOGLE_EMAIL, res.email);
      setDone(true);
      setTimeout(onClose, 2500);
    } catch {
      setError('Google 연결 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const later = () => {
    localStorage.setItem(LS.GOOGLE_LINK_PROMPT_SNOOZED_UNTIL, String(Date.now() + SNOOZE_MS));
    onClose();
  };

  if (done) {
    return (
      <div className="ppp-banner ppp-done" role="status">
        <span className="ppp-icon"><GoogleIcon size={20} /></span>
        <p className="ppp-title">Google 계정이 연결됐어요</p>
      </div>
    );
  }

  return (
    <div className="ppp-banner" role="dialog" aria-label="Google 로그인 연결 안내">
      <span className="ppp-icon"><GoogleIcon size={20} /></span>
      <div className="ppp-text">
        <p className="ppp-title">다음부터 Google로 간편 로그인</p>
        <p className="ppp-desc">{error || '연결해 두면 아이디·비밀번호 없이 버튼 한 번으로 들어올 수 있어요'}</p>
      </div>
      <div className="ppp-actions">
        <button className="ppp-btn" onClick={link} disabled={busy}>{busy ? '...' : '연결하기'}</button>
        <button className="ppp-later" onClick={later}>나중에</button>
      </div>
    </div>
  );
}
