import { useState } from 'react';
import './LoginScreen.css';

const SAVED_ID_KEY = 'familyTreeSavedUsername';

interface Props {
  onLogin: (username: string, password: string) => void;
  onGoogleLogin: () => void;
  onRegister: () => void;
  error?: string;
  success?: string;
  loading?: boolean;
}

export function LoginScreen({ onLogin, onGoogleLogin, onRegister, error, success, loading }: Props) {
  const savedId = localStorage.getItem(SAVED_ID_KEY) ?? '';
  const [username, setUsername] = useState(savedId);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(!!savedId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = username.trim();
    if (!u || !password) return;
    if (rememberMe) {
      localStorage.setItem(SAVED_ID_KEY, u);
    } else {
      localStorage.removeItem(SAVED_ID_KEY);
    }
    onLogin(u, password);
  };

  return (
    <div className="login-screen">
      <div className="login-card">

        <h1 className="login-title">우리 가족 가계도</h1>

        {success && (
          <div className="login-success">
            {success}
          </div>
        )}

        <button className="google-login-btn" onClick={onGoogleLogin} disabled={loading}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Google로 로그인
        </button>

        <div className="login-divider"><span>또는</span></div>

        <form onSubmit={handleSubmit} className="login-form">
          <input
            className="login-input"
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="아이디"
            autoComplete="username"
            maxLength={30}
          />
          <input
            className="login-input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="비밀번호"
            autoComplete="current-password"
            maxLength={50}
          />

          <label className="remember-me">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
            />
            <span>아이디 기억하기</span>
          </label>

          {error && <p className="login-error">{error}</p>}

          <button
            className="login-btn"
            type="submit"
            disabled={!username.trim() || !password || loading}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
          <button type="button" className="login-register-btn" onClick={onRegister}>
            처음이신가요? 회원가입
          </button>
        </form>
      </div>
    </div>
  );
}
