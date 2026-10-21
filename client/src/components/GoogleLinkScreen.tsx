import { useState } from 'react';
import { loginMember } from '../services/authService';
import type { Member } from '../types';
import { GoogleIcon } from './GoogleIcon';
import './GoogleLinkScreen.css';
import './LoginScreen.css';

interface Props {
  googleEmail: string;
  displayName: string;
  onLinkedToExisting: (member: Member) => void;
  onNewStart: () => void;
  onCancel: () => void;
}

export function GoogleLinkScreen({ googleEmail, displayName, onLinkedToExisting, onNewStart, onCancel }: Props) {
  const [mode, setMode]       = useState<'choose' | 'link'>('choose');
  const [username, setUser]   = useState('');
  const [password, setPass]   = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const member = await loginMember(username.trim(), password);
      if (!member) { setError('아이디 또는 비밀번호가 올바르지 않습니다.'); return; }
      onLinkedToExisting(member);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glink-screen">
      <div className="glink-card">
        <div className="glink-google-badge">
          <GoogleIcon size={28} />
          <span>Google 계정으로 로그인됨</span>
        </div>

        <p className="glink-email">{displayName || googleEmail}</p>
        <p className="glink-email-sub">{googleEmail}</p>

        {mode === 'choose' ? (
          <>
            <p className="glink-desc">이 구글 계정과 연결된 가계도 계정이 없습니다.<br/>어떻게 하시겠어요?</p>
            <div className="glink-options">
              <button className="glink-btn primary" onClick={() => setMode('link')}>
                기존 계정과 연결
                <span className="glink-btn-sub">아이디/비밀번호로 확인 후 연결</span>
              </button>
              <button className="glink-btn secondary" onClick={onNewStart}>
                처음 시작하기
                <span className="glink-btn-sub">가족 트리 개설 신청</span>
              </button>
            </div>
            <button className="glink-cancel" onClick={onCancel}>취소</button>
          </>
        ) : (
          <>
            <p className="glink-desc">기존 가계도 계정의 아이디와 비밀번호를 입력하세요.<br/>연결 후 구글로 로그인할 수 있습니다.</p>
            <form className="login-form" onSubmit={handleLink}>
              <input
                className="login-input"
                type="text"
                value={username}
                onChange={e => setUser(e.target.value)}
                placeholder="아이디"
                autoFocus
                maxLength={30}
              />
              <input
                className="login-input"
                type="password"
                value={password}
                onChange={e => setPass(e.target.value)}
                placeholder="비밀번호"
                maxLength={50}
              />
              {error && <p className="login-error">{error}</p>}
              <button
                className="glink-btn primary"
                type="submit"
                disabled={loading || !username.trim() || !password}
              >
                {loading ? '확인 중...' : '연결하기'}
              </button>
            </form>
            <button className="glink-cancel" onClick={() => { setMode('choose'); setError(''); }}>뒤로</button>
          </>
        )}
      </div>
    </div>
  );
}
