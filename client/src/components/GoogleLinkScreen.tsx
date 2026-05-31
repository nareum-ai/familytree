import { useState } from 'react';
import { useFamilyStore } from '../store/familyStore';
import type { Member } from '../types';
import './GoogleLinkScreen.css';

interface Props {
  googleEmail: string;
  displayName: string;
  onLinkedToExisting: (member: Member) => void;
  onNewStart: () => void;
  onCancel: () => void;
}

export function GoogleLinkScreen({ googleEmail, displayName, onLinkedToExisting, onNewStart, onCancel }: Props) {
  const { loginMember } = useFamilyStore();
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
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="28" height="28">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
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
            <form className="glink-form" onSubmit={handleLink}>
              <input
                className="glink-input"
                type="text"
                value={username}
                onChange={e => setUser(e.target.value)}
                placeholder="아이디"
                autoFocus
                maxLength={30}
              />
              <input
                className="glink-input"
                type="password"
                value={password}
                onChange={e => setPass(e.target.value)}
                placeholder="비밀번호"
                maxLength={50}
              />
              {error && <p className="glink-error">{error}</p>}
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
