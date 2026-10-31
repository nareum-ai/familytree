import { useState } from 'react';
import { registerMember } from '../services/authService';
import InAppBrowserBanner from './InAppBrowserBanner';
import { isInAppBrowser } from '../lib/device';
import { GoogleIcon } from './GoogleIcon';
import './LoginScreen.css';
import './RegisterScreen.css';

interface Props {
  onBack: () => void;
  onSuccess: (username: string, password: string) => void;
  onGoogleLogin?: () => void;
  googleError?: string;
  googleLoading?: boolean;
}

export function RegisterScreen({ onBack, onSuccess, onGoogleLogin, googleError, googleLoading }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const inApp = isInAppBrowser();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    if (username.trim().length < 2) { setError('아이디는 2자 이상이어야 합니다.'); return; }
    if (password.length < 6)        { setError('비밀번호는 6자 이상이어야 합니다.'); return; }
    if (password !== confirm)        { setError('비밀번호가 일치하지 않습니다.'); return; }

    setLoading(true);
    const result = await registerMember(username.trim(), password)
      .catch(() => ({ ok: false, error: '가입 중 오류가 발생했습니다. 다시 시도해주세요.' }));
    setLoading(false);
    if (result.ok) {
      onSuccess(username.trim(), password);
    } else {
      setError(result.error ?? '회원가입에 실패했습니다.');
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1 className="login-title">회원가입</h1>

        {inApp && <InAppBrowserBanner />}

        {onGoogleLogin && !inApp && (
          <>
            <button
              className="google-login-btn"
              onClick={onGoogleLogin}
              disabled={googleLoading}
            >
              <GoogleIcon size={20} />
              Google로 계속하기
            </button>
            {googleError && <p className="login-error">{googleError}</p>}
            <div className="login-divider"><span>또는</span></div>
          </>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <input
            className="login-input"
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="아이디 (2자 이상)"
            autoFocus
            maxLength={30}
          />
          <input
            className="login-input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="비밀번호 (6자 이상)"
            maxLength={50}
          />
          <input
            className="login-input"
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="비밀번호 확인"
            maxLength={50}
          />
          {error && <p className="login-error">{error}</p>}
          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? '처리 중...' : '아이디로 가입하기'}
          </button>
          <button type="button" className="reg-back-btn" onClick={onBack}>
            이미 계정이 있으신가요? 로그인
          </button>
        </form>
      </div>
    </div>
  );
}
