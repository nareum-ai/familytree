import { useState } from 'react';
import { useFamilyStore } from '../store/familyStore';
import InAppBrowserBanner, { isInAppBrowser } from './InAppBrowserBanner';
import './LoginScreen.css';
import './RegisterScreen.css';

interface Props {
  onBack: () => void;
  onSuccess: (username: string) => void;
  onGoogleLogin?: () => void;
  googleError?: string;
  googleLoading?: boolean;
}

export function RegisterScreen({ onBack, onSuccess, onGoogleLogin, googleError, googleLoading }: Props) {
  const { registerMember } = useFamilyStore();
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
    const result = await registerMember(username.trim(), password);
    setLoading(false);
    if (result.ok) {
      onSuccess(username.trim());
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
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
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
